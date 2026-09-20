> **Partiellement remplacé par [ADR-0015](0015-paiement-stripe-sans-stores.md)** : le paiement passe par Stripe, plus par RevenueCat / les stores. Scope par foyer, quotas et point de contrôle au registre restent valables.

# ADR-0014 — Abonnement IA par foyer via RevenueCat, quota au registre de providers

## Contexte

L'instance officielle hébergée (`INSTANCE_MODE=hosted`) ne peut pas laisser payer les
appels IA (scan de ticket, scan de frigo, génération de recette) par l'opérateur sans
limite : coût direct par foyer, pas de rôle instance-admin pour l'arbitrer (ADR-0004).
Une instance auto-hébergée n'a pas ce problème — l'opérateur paie déjà ses propres
clés API — et ne doit donc jamais être plafonnée.

Paiement in-app géré par RevenueCat (App Store / Play Store), pas de facturation web :
mobile-only, cohérent avec le reste de l'app.

## Décision

- **Scope** : l'abonnement est par foyer (`household_subscription`, PK
  `household_id`), pas par utilisateur — n'importe quel membre peut être le payeur.
  `app_user_id` RevenueCat = `household_id` directement, pas de table de mapping.
- **Quota, pas tout-ou-rien** : chaque foyer a un quota mensuel d'appels IA —
  `AI_QUOTA_FREE` (défaut 5) sans abonnement actif, `AI_QUOTA_SUBSCRIBED` (défaut 150)
  avec. Compté par mois calendaire UTC (`ai_usage`, PK `(household_id, period)`).
  Les deux quotas sont des no-op quand `INSTANCE_MODE != hosted` — l'auto-hébergement
  n'est jamais plafonné.
- **Point de contrôle unique** : le quota est appliqué dans `ai-provider-registry.ts`,
  pas dans chaque use-case IA — c'est le seul endroit qui résout déjà les trois ports
  IA (extraction ticket, scan frigo, génération recette). `AiQuotaExceededError`
  (402) est levée avant tout appel adapter ; la conso n'est enregistrée qu'après succès
  de l'appel sous-jacent (un appel qui échoue ne consomme pas le quota).
- **Webhook** : `POST /api/webhooks/revenuecat`, authentifié par un bearer token
  (`REVENUECAT_WEBHOOK_SECRET`, comparaison à temps constant), 404 hors mode hosted.
  Les événements d'entitlement (`INITIAL_PURCHASE`, `RENEWAL`, `EXPIRATION`, etc.)
  font un upsert de `expires_at` sur `household_subscription` — pas de state machine,
  RevenueCat est la source de vérité, le backend ne fait que refléter la date
  d'expiration qu'il envoie.
- **Résiliation** : quand le payeur quitte le foyer, en est retiré, ou supprime son
  compte, le backend révoque immédiatement l'accès (`revokeForPayer` met
  `expires_at` à maintenant), sans attendre de confirmation store-side — le mobile est
  seulement guidé vers la gestion d'abonnement native de l'OS pour l'annulation
  effective côté paiement. Asymétrique par design : Apple/Google ne préviennent pas
  le backend de la même façon selon la plateforme, donc le foyer perd l'accès tout de
  suite, quitte à ce que le payeur continue d'être facturé jusqu'à annulation
  manuelle dans l'App Store / Play Store.
- Suppression du foyer (`ON DELETE CASCADE` sur `household_subscription`) n'a pas
  besoin de code de révocation explicite.

## Conséquences

- Un foyer peut avoir un payeur qui n'est plus membre entre le moment où RevenueCat
  facture et le prochain webhook de renouvellement — assumé : la fenêtre est au plus
  un cycle de facturation, corrigée dès la prochaine notification store.
- Pas de remboursement automatique déclenché par la révocation applicative : c'est un
  problème de gestion d'abonnement (store), pas de ce backend.
- Le script `backend/bin/simulate-revenuecat-webhook.js` permet de rejouer les
  scénarios de paiement (succès, échec, expiration, foyer inconnu) sans compte
  App Store / Play Store réel, pour le développement local.
