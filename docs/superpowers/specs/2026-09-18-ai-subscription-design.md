> Superseded pour le paiement par [ADR-0015](../../adr/0015-paiement-stripe-sans-stores.md) (Stripe au lieu de RevenueCat).

# Abonnement IA sur l'instance officielle — design

Statut : **à valider** · 2026-09-18

## Objectif

Sur l'instance officielle (`INSTANCE_MODE=hosted`), les fonctionnalités IA
(scan de ticket, scan de frigo, génération de recettes) passent par un
abonnement **par foyer à 2 €/mois**, vendu en achat in-app via RevenueCat.
Les non-abonnés gardent un petit quota gratuit mensuel. En auto-hébergement,
rien ne change : pas d'abonnement, pas de quota, et le foyer choisit son
provider.

## Décisions (validées en amont)

| Sujet | Décision |
|---|---|
| Paiement | RevenueCat + IAP App Store / Play Store |
| Portée | Le foyer ; n'importe quel membre peut souscrire |
| Non-abonné (hébergé) | 5 utilisations IA/mois/foyer |
| Abonné (hébergé) | 150 utilisations IA/mois/foyer (usage raisonnable) |
| Unité de quota | 1 ticket = 1, 1 photo de frigo = 1, 1 génération de recettes = 1 ; seuls les appels **réussis** sont comptés |
| Période | Mois calendaire UTC, remise à zéro le 1er |
| Provider (hébergé) | Figé par l'opérateur (`AI_PROVIDER`), page de choix masquée |
| Provider (auto-hébergé) | Choix libre, comme aujourd'hui ; pas de verrou « cloud » |
| Extras payants | Aucun pour l'instant |
| Config | `INSTANCE_MODE` seul ; `SAAS_MODE` est supprimé |
| Expo Go | Achat indisponible (écran dégradé) ; il faut un build EAS |
| Guide auto-hébergé | Lien vers `README.fr.md#ia-scan-de-tickets-recettes` |

Hors périmètre : cumul d'extras payants, offre annuelle, essai gratuit côté
store, back-office admin, CGV / politique de confidentialité (nécessaires
pour publier sur les stores, mais c'est un chantier à part), mise à jour du
prix sur la landing.

## Backend

### Configuration (`start/env.ts`, `.env.example`, `compose.yml`)

- Supprimé : `SAAS_MODE`.
- `INSTANCE_MODE=hosted` active abonnement + quotas + provider figé.
- Nouveau : `REVENUECAT_WEBHOOK_SECRET` (obligatoire si `hosted`, vérifié au
  démarrage).
- Nouveau : `AI_QUOTA_FREE` (5 par défaut), `AI_QUOTA_SUBSCRIBED` (150 par
  défaut) — en env, car ces deux valeurs vont bouger après les premiers
  retours de coût.

### Données (2 migrations)

`household_subscription`

| Colonne | Type | Note |
|---|---|---|
| `household_id` | uuid PK, FK `household` `ON DELETE CASCADE` | un seul abonnement par foyer |
| `payer_user_id` | uuid, nullable, FK `user` `ON DELETE SET NULL` | informatif (« payé par … ») |
| `store` | text | `app_store` \| `play_store` |
| `expires_at` | timestamptz | le droit se termine ici |
| `updated_at` | timestamptz | |

Un foyer est abonné si `expires_at > now()`. Pas de colonne `status` : les
événements RevenueCat (renouvellement, annulation, expiration, problème de
paiement) se ramènent tous à une nouvelle date d'expiration.

`ai_usage`

| Colonne | Type |
|---|---|
| `household_id` | uuid, FK `household` `ON DELETE CASCADE` |
| `period` | text `YYYY-MM` |
| `count` | int |

PK `(household_id, period)`. Incrément atomique :
`INSERT … ON CONFLICT DO UPDATE SET count = ai_usage.count + 1`.

### Domaine / application

- `SubscriptionPort.hasActiveSubscription` est conservé ; la nouvelle
  implémentation `LucidSubscriptionAdapter` renvoie `true` en auto-hébergé,
  sinon lit `household_subscription`. `EnvSubscriptionAdapter` est supprimé.
- Nouveau `AiQuotaPort` : `usage(householdId) → { used, limit, resetsAt }`
  (limit `null` en auto-hébergé) et `record(householdId)`.
- Nouvelle erreur domaine `AiQuotaExceededError` → code
  `ai_quota_exceeded`, HTTP **402**, message : « Tu as utilisé tes N
  utilisations IA du mois. ».
- Suppression de `lockedProviders`, `CLOUD_AI_PROVIDERS`,
  `isCloudAiProvider`, `SubscriptionRequiredError` / `subscription_required` :
  le verrou porte désormais sur l'usage, plus sur le provider.

### Point de contrôle unique : `ai-provider-registry.ts`

Les trois resolvers (`receipt`, `recipe`, `fridgeScan`) passent déjà tous
par `createResolver.resolve()`. On y ajoute :

1. avant de renvoyer l'adapter : `usage.used >= usage.limit` → lever
   `AiQuotaExceededError` ;
2. l'adapter renvoyé est enveloppé pour appeler `quota.record(householdId)`
   **après** un appel réussi (une exception ⇒ pas de décompte).

Aucun use-case de receipt/recipe/fridge n'est modifié.

> ponytail : contrôle puis incrément non atomiques ; deux scans simultanés
> au 150e appel peuvent passer à 151. Acceptable, à durcir avec un
> `UPDATE … WHERE count < limit RETURNING` si ça se voit.

### Provider sur l'instance hébergée

- `PATCH /api/settings/ai` → **403** `provider_choice_disabled` si `hosted`.
- `activeProvider` = premier provider disponible de `AI_PROVIDER` ; une
  éventuelle ligne en base est ignorée en mode hébergé.

### Endpoints

`GET /api/settings/ai` — DTO étendu, un seul appel pour l'écran Réglages
et les points d'entrée IA :

```jsonc
{
  "activeProvider": "gemini",
  "source": "environment",
  "availableProviders": ["gemini"],
  "models": { "vision": "…", "text": "…" },
  "canChooseProvider": false,          // false si hosted
  "access": {
    "plan": "free",                    // "self-hosted" | "free" | "subscriber"
    "used": 3,
    "limit": 5,                        // null en self-hosted
    "resetsAt": "2026-10-01T00:00:00Z", // null en self-hosted
    "expiresAt": null                  // date de fin si subscriber
  }
}
```

`POST /api/webhooks/revenuecat` — public, protégé par
`Authorization: Bearer ${REVENUECAT_WEBHOOK_SECRET}` (comparaison en temps
constant), 404 si non `hosted`.

- `app_user_id` RevenueCat = **`householdId`** : tout membre qui achète
  crédite le foyer, et « Restaurer les achats » fonctionne pour le payeur
  quel que soit le membre connecté.
- Événements `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`,
  `PRODUCT_CHANGE`, `CANCELLATION`, `BILLING_ISSUE`, `EXPIRATION` : upsert
  de `expires_at = expiration_at_ms`. `TEST` : 200 sans effet. Autres : 200
  ignoré.
- Idempotent : upsert qui ne recule jamais `expires_at`, sauf sur
  `EXPIRATION`.
- `app_user_id` inconnu (foyer supprimé) : 200 ignoré, avec log.

`payer_user_id` : avant l'achat, le mobile pose l'attribut d'abonné
RevenueCat `user_id` (`Purchases.setAttributes`) ; le webhook le relit dans
`subscriber_attributes`.

## Mobile

### Dépendances

- `react-native-purchases` + `expo-dev-client` ; configuration avec
  `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
- `Purchases.logIn(householdId)` quand le foyer est connu, en mode `hosted`
  uniquement ; jamais initialisé en auto-hébergé.
- Expo Go (`Constants.executionEnvironment === 'storeClient'`) : le SDK
  n'est pas chargé, le paywall affiche « L'abonnement n'est pas disponible
  dans cette version de l'app. ».

### Domaine

`AiSettings` suit le DTO : suppression de `lockedProviders`, ajout de
`canChooseProvider` et `access`.

### Hook `useAiAccess()`

Dérivé de `useAiSettingsQuery` + `useInstanceInfoQuery` :

| État | Condition | Rendu au point d'entrée |
|---|---|---|
| `ok` | provider dispo et quota restant | action normale |
| `setup-needed` | auto-hébergé, `availableProviders` vide | `AiSetupGuideCard` |
| `quota-exceeded` | hébergé, `used >= limit` | `SubscriptionPaywall` |
| `loading` | requêtes en cours | action désactivée |

Une 402 `ai_quota_exceeded` renvoyée par l'API (course, cache périmé)
invalide `['ai-settings']` et ouvre le paywall.

### Composants

- **`SubscriptionPaywall`** (feuille/écran `/subscription`) : ce que ça
  débloque (tickets, frigo, recettes), « 2 € / mois pour tout le foyer »
  (prix réel lu depuis l'offering RevenueCat, localisé par le store), jauge
  du quota gratuit restant, boutons **S'abonner** et **Restaurer mes
  achats**. Après achat : invalidation de `['ai-settings']` + nouvelle
  lecture jusqu'à `plan: subscriber` (le webhook peut avoir quelques
  secondes de retard).
- **`AiQuotaHint`** : ligne discrète « 3 / 5 utilisations IA ce mois » sur
  les points d'entrée, hébergé uniquement ; pour les abonnés, affichée
  seulement au-delà de 80 %.
- **`AiSetupGuideCard`** : « Aucune IA n'est configurée sur ce serveur. »
  + bouton « Voir le guide » ouvrant
  `https://github.com/floriaaan/fridge-ai/blob/main/README.fr.md#ia-scan-de-tickets-recettes`
  dans le navigateur (`expo-web-browser`).

### Points d'entrée restreints

- Scan de ticket (onglet Tickets → scan)
- Scan de frigo (`fridge-scan`)
- Génération de recettes (onglet Recettes)

Restent libres : recettes manuelles, recettes IA déjà enregistrées (même
après expiration), code-barres (Open Food Facts, sans IA), tout le reste.

### Réglages > Intelligence artificielle

- **Auto-hébergé** : page actuelle (choix du provider) sans l'état
  « verrouillé » ; `AiSetupGuideCard` si aucun provider.
- **Hébergé** : la page devient « Abonnement » : statut (gratuit / abonné
  jusqu'au …), quota du mois, S'abonner ou Gérer (lien vers la gestion
  d'abonnement du store : `Purchases.showManageSubscriptions()`),
  Restaurer mes achats. Pas de choix de provider.

## Configuration manuelle (hors code, à ta charge)

- App Store Connect / Play Console : abonnement mensuel
  `garde_manger_ai_monthly`, prix palier 1,99 €.
- RevenueCat : entitlement `ai`, offering par défaut avec ce produit,
  webhook vers `https://<instance>/api/webhooks/revenuecat` avec le secret.

## Tests

- Backend : webhook (auth, upsert, idempotence, expiration, foyer inconnu),
  quota (refus au-delà de la limite, pas de décompte sur échec, remise à
  zéro au changement de mois via `Clock`), `PATCH /api/settings/ai` 403 en
  hébergé, auto-hébergé inchangé (pas de quota).
- Mobile : `useAiAccess` (4 états), paywall en Expo Go, redirection vers
  paywall sur 402, page Réglages dans les deux modes.

## Documentation

- ADR 0014 « Abonnement IA par foyer via RevenueCat, quota au registre de
  providers ».
- `README.fr.md` / `README.md` : section IA vérifiée comme guide autonome
  (l'ancre doit rester stable), mention `INSTANCE_MODE`.

## Points ouverts

1. Suppression du foyer par un membre abonné : le droit disparaît, mais le
   store continue de facturer tant qu'il ne résilie pas. On affiche un
   avertissement avant suppression/départ du payeur ? (proposé : oui, un
   texte simple).
2. Mise à jour du prix sur la landing (« 2 €/mois ») maintenant ou au
   lancement ?
