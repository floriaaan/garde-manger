> **Complété par [ADR-0019](0019-pas-de-facturation-sur-ios.md)** : la build iOS ne propose pas cet abonnement (règle App Store 3.1.1). Android et le web ne changent pas.

# ADR-0015 — Paiement de l'abonnement IA via Stripe, sans achat in-app

## Contexte

L'ADR-0014 déléguait le paiement à RevenueCat (App Store / Play Store). Ce circuit
impose un SDK natif (donc plus d'Expo Go), un compte développeur par store, une
commission de 15 à 30 % et une résiliation que le backend ne maîtrise pas (il ne
pouvait que révoquer l'accès, pas arrêter la facturation). On passe à Stripe seul.

## Décision

- **Stripe Checkout + Customer Portal**, pages hébergées par Stripe. Le mobile ne
  manipule aucune donnée de paiement ni SDK : `POST /api/settings/subscription/checkout`
  et `.../portal` renvoient une URL, ouverte dans le navigateur système
  (`expo-web-browser`). `react-native-purchases` est supprimé.
- **Webhook** `POST /api/webhooks/stripe`, authentifié par la signature
  `Stripe-Signature` (HMAC-SHA256 du corps brut, tolérance 5 min, comparaison à temps
  constant) avec `STRIPE_WEBHOOK_SECRET`. 404 hors mode hosted. Seuls les événements
  `customer.subscription.created|updated|deleted` sont exploités, le reste est acquitté
  sans effet. Appels à l'API Stripe en `fetch` direct (trois endpoints, pas de SDK).
- **Même modèle qu'avant** : Stripe est la source de vérité, le backend reflète
  `expires_at` sur `household_subscription` — fin de période payée tant que le statut
  est `active`/`trialing`/`past_due`, `now` sinon. Le foyer est porté par
  `metadata.household_id` posé sur l'abonnement à la création du Checkout ; le payeur
  par `metadata.payer_user_id`. La colonne `store` laisse place à
  `stripe_customer_id` / `stripe_subscription_id` (nullables : les lignes antérieures
  gardent leur échéance).
- **Portail réservé au payeur** : il expose sa carte et ses factures.
- **Résiliation maîtrisée** : quand le payeur quitte le foyer, en est retiré ou supprime
  son compte, l'accès est révoqué **et** l'abonnement Stripe est annulé
  (`RevokePayerSubscriptions`). Un échec d'annulation est journalisé mais ne bloque jamais
  le départ. Avec les stores, la facturation continuait jusqu'à annulation manuelle.
- Un événement de fin d'un ancien abonnement n'écrase pas un abonnement plus récent
  encore valide (Stripe ne garantit pas l'ordre des événements).

## Conséquences

- Configuration requise en hosted : `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
  `STRIPE_WEBHOOK_SECRET` (+ `STRIPE_RETURN_URL` optionnel). Sans elles, les endpoints
  répondent `billing_unavailable`.
- Après fermeture du navigateur, le mobile rafraîchit les réglages IA tout de suite puis
  3 s plus tard : le webhook peut arriver légèrement après.
- **Risque de revue store** : Apple (guideline 3.1.1) et Google Play imposent en principe
  leur propre facturation pour les biens numériques consommés dans l'app ; un lien
  externe n'est toléré que selon la région (entitlements « external purchase »,
  États-Unis, UE). À valider avant publication sur les stores.
- Les CGV et la politique de confidentialité désignent Stripe comme prestataire.
- Le simulateur `simulate-revenuecat-webhook.js` est supprimé ; en local, utiliser
  `stripe listen --forward-to localhost:3333/api/webhooks/stripe` et `stripe trigger`.
