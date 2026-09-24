# App Privacy — réponses App Store Connect

Réponses au questionnaire *App Privacy* d'App Store Connect, tirées du code de la
branche `chore/ios-release-prep`. Elles portent sur l'instance officielle
(`https://api-gardemanger.floriaaan.fr`) : c'est celle que la fiche présente. Une
instance auto-hébergée est opérée par son propriétaire. L'éditeur n'y collecte rien.

Rappel des définitions d'Apple :

- *Collecté* : les données quittent l'appareil et sont conservées au-delà du temps de
  traitement de la requête.
- *Lié à l'utilisateur* : rattaché à son compte ou à son identité.
- *Suivi* : croisé avec des données d'autres entreprises à des fins publicitaires, ou
  partagé avec un data broker.

## Suivi (tracking)

**Non.** Aucun SDK publicitaire ou d'analytics tiers dans `mobile/package.json`, aucun
IDFA, pas de `NSUserTrackingUsageDescription`. La télémétrie part vers notre propre
backend (voir *Diagnostics*).

## Données collectées

Toutes les données ci-dessous sont **liées à l'utilisateur** et **ne servent pas au
suivi**.

| Catégorie Apple | Type | Finalités | Source dans le code |
|---|---|---|---|
| Contact Info | Name | App Functionality | Inscription better-auth (`name`), `mobile/src/presentation/identity/`, `backend/src/infrastructure/auth/better-auth/instance.ts` |
| Contact Info | Email Address | App Functionality | Idem. Sert à la connexion et à la réinitialisation du mot de passe |
| User Content | Photos or Videos | App Functionality | Photos de tickets (`mobile/src/presentation/receipt/receipt-scanner-screen.tsx`) et du frigo (`mobile/src/presentation/fridge/fridge-scan-camera-screen.tsx`), envoyées pour extraction. Les images de tickets sont conservées (`landing/src/presentation/legal/privacy-page.tsx`, tableau des durées) |
| User Content | Other User Content | App Functionality | Produits, dates de péremption, historique consommé/jeté, liste de courses, recettes générées, tickets (magasin, date, montant). Tables `product`, `product_outcome`, `shopping_item`, `receipt`… |
| Identifiers | User ID | App Functionality, Analytics | Id de compte better-auth. La télémétrie en envoie un dérivé HMAC (`pseudoUserId`, `backend/src/infrastructure/telemetry/otlp-telemetry-relay.ts`) |
| Identifiers | Device ID | App Functionality | Jeton push Expo enregistré sur le serveur pour les rappels de péremption (`mobile/src/application/push/push-notifications.ts`, `backend/src/infrastructure/push/expo-push-sender.ts`). Déclaration prudente : Apple ne classe pas clairement les jetons push |
| Diagnostics | Performance Data | App Functionality, Analytics | Spans OTLP des requêtes HTTP : méthode, chemin sans query string, code HTTP, durée (`mobile/src/infrastructure/http/http-client.ts`) |
| Diagnostics | Other Diagnostic Data | App Functionality | Erreurs (`recordError`) avec la version de l'app, l'OS et un id de session aléatoire par lancement (`mobile/src/infrastructure/telemetry/telemetry.ts`, `resource.ts`) |

Choix prudents :

- La télémétrie est déclarée **liée** : le relais backend
  (`backend/src/presentation/telemetry/telemetry.controller.ts`, `otlp-telemetry-relay.ts`) y attache un
  identifiant pseudonyme stable, dérivé de l'utilisateur. Apple considère une donnée
  pseudonymisée comme liée tant qu'elle reste rattachable.
- *Crash Data* n'est pas cochée : il n'y a pas de rapport de crash natif, seulement les
  erreurs JS listées ci-dessus. La cocher si un outil de crash est ajouté.

## Données non collectées

- **Location** : pas de `expo-location`, aucune permission de localisation.
- **Contacts, Health, Financial Info, Sensitive Info, Browsing/Search History** : rien.
- **Purchases** : la build iOS ne propose aucun achat (ADR-0019). Un abonnement Stripe pris
  sur le web reste attaché au compte côté serveur, mais l'app iOS ne le collecte pas.
  *Purchase History* est donc à laisser décoché, à reconsidérer si l'app affiche un jour
  l'état de l'abonnement sur iOS.
- **Audio** : micro désactivé (`app.json`, plugins `expo-camera` et
  `expo-image-picker`).
- **Credentials / clés d'accès** : les clés publiques des passkeys et les mots de passe
  (hachés) ne correspondent à aucune catégorie Apple ; rien à déclarer.

## Tiers qui reçoivent des données

À refléter dans la politique de confidentialité, pas dans le questionnaire (qui ne
demande que les catégories).

| Tiers | Données | Code |
|---|---|---|
| Expo push service (`exp.host`), puis APNs | Jeton push, texte des notifications (noms de produits qui périment) | `backend/src/infrastructure/push/expo-push-sender.ts` |
| Open Food Facts | Codes-barres scannés, envoyés par le serveur | `backend/src/infrastructure/fridge/openfoodfacts-adapter.ts` |
| Fournisseur IA configuré sur l'instance (Ollama, Gemini ou OpenAI) | Photos de tickets et du frigo, liste de produits pour les recettes | `backend/src/infrastructure/settings/ai-provider-registry.ts` |
| Collecteur OTLP (endpoint configuré côté backend) | Télémétrie décrite ci-dessus | `backend/src/infrastructure/telemetry/otlp-telemetry-relay.ts` |

## Écarts avec `landing/` /privacy — corrigés

La page `https://gardemanger.floriaaan.fr/privacy`
(`landing/src/presentation/legal/privacy-page.tsx`) est l'URL de confidentialité de la
fiche. Les 8 écarts relevés lors de l'audit sont corrigés sur la branche :

1. Télémétrie de l'app (diagnostics, identifiant pseudonyme, durée de conservation) —
   ajoutée à « Données collectées » et à « Durées de conservation ».
2. « Aucun cookie ni traceur » — reformulé : aucun traceur publicitaire ou de mesure
   d'audience, mais un cookie/jeton de session strictement nécessaire à la connexion.
3. Notifications push — section dédiée : service Expo puis APNs/FCM, jeton et contenu.
4. Open Food Facts — section dédiée : codes-barres transmis pour identifier un produit.
5. Fournisseur IA — corrigé : Gemini (Google) en production sur l'instance officielle,
   pas Ollama, avec la mention du transfert hors UE. À revérifier si `AI_PROVIDER`
   change côté serveur officiel.
6. Home Assistant — ajouté à « Données collectées ».
7. Clés d'accès — ajoutées à la section connexion.
8. Lien vers la politique dans l'app — ajouté dans Réglages (« Confidentialité » et
   « Conditions d'utilisation »).
