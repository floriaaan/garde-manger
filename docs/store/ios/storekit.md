# Abonnement natif iOS — StoreKit 2 (#110)

## Fonctionnement

- iOS utilise `expo-iap` / StoreKit 2 : prix et nom localisés provenant de
  l’App Store, abonnement mensuel, restauration et feuille native de gestion.
- Android et web conservent Stripe Checkout et Customer Portal. Aucun appel
  Google Play Billing n’est ajouté au parcours Android.
- Le backend réunit les droits Stripe et Apple au niveau du foyer. Les deux
  sources gardent leur stockage et leur cycle de vie indépendants : le webhook
  Stripe ne peut pas écraser un droit Apple et inversement. Les quotas restent
  ceux du foyer (5 gratuits / 150 abonnés par défaut), toutes plateformes confondues.
- Un foyer déjà abonné n’a pas de nouvelle offre d’achat. Le serveur est revérifié
  juste avant de présenter le dialogue Apple ; Stripe refuse aussi un nouveau
  checkout si un abonnement Apple est actif. Cela évite les doubles achats
  courants, sans prétendre annuler deux achats simultanés sur deux appareils.
- Un abonnement s’annule auprès du service qui l’a vendu. Sur iOS, les abonnements
  Apple ouvrent la feuille native App Store ; les abonnements Stripe déjà actifs
  restent utilisables sans lien de paiement externe. Sur Android/web, un abonnement
  Apple est présenté comme géré par Apple, sans ouvrir le portail Stripe.

## Configuration App Store Connect (à effectuer avant la soumission)

1. Pour l’app `com.floriaaan.gardemanger` (Apple ID `6816469647`), vérifier le
   contrat Paid Apps, les coordonnées bancaires et les informations fiscales.
2. Créer un groupe d’abonnements puis **un abonnement mensuel à renouvellement
   automatique**. Identifiant suggéré : `com.floriaaan.gardemanger.ai.monthly`.
   Utiliser exactement cet identifiant dans `APPLE_IAP_PRODUCT_ID`.
3. Configurer le prix souhaité (l’offre Stripe actuelle est de 0,99 €/mois), les
   territoires, le nom et la description localisés, les informations de review
   et la capture demandée. Le prix iOS affiché provient exclusivement du Store.
   Ne pas activer Family Sharing : le partage est assuré par le foyer Garde-manger.
4. Dans Users and Access > Integrations > In-App Purchase, créer une clé API.
   Ce sont des identifiants distincts de Sign in with Apple. Renseigner côté serveur :

   ```dotenv
   INSTANCE_MODE=hosted
   APPLE_IAP_PRODUCT_ID=com.floriaaan.gardemanger.ai.monthly
   APPLE_IAP_ISSUER_ID=<issuer UUID>
   APPLE_IAP_KEY_ID=<In-App Purchase key ID>
   APPLE_IAP_PRIVATE_KEY=<PEM privé ; retours ligne réels ou séquences littérales \n>
   APPLE_IAP_BUNDLE_ID=com.floriaaan.gardemanger
   APPLE_IAP_APP_ID=6816469647
   APPLE_IAP_ALLOW_SANDBOX=true
   ```

   La sandbox est nécessaire aux achats TestFlight/App Review. La production
   reste acceptée en parallèle. Sans activation explicite de sandbox, seuls
   les achats de production sont acceptés. Une transaction Xcode locale
   n’est jamais acceptée par ce backend. Choisir consciemment la politique
   sandbox de l’instance utilisée pour la revue, sans désactiver les
   transactions sandbox tant que les comptes de review doivent les restaurer.
5. Configurer **App Store Server Notifications V2**, en production et sandbox :
   `https://api-gardemanger.floriaaan.fr/api/webhooks/apple`. Envoyer une
   notification TEST et vérifier sa réception avant soumission.
6. Associer le premier abonnement à la version iOS soumise. Remplir les notes
   App Review et fournir un compte de démonstration fonctionnel.

Aucun secret Apple n’est embarqué dans le mobile. Le backend transmet seulement
l’identifiant produit et un `appAccountToken` UUID stable par compte Garde-manger.

## Validation et sécurité

L’app transmet le JWS de la transaction à `POST /api/settings/subscription/apple`.
Le serveur vérifie les signatures/certificats avec la bibliothèque officielle
Apple (vérifications de révocation en ligne), le bundle, l’environnement, le
produit, le type renouvelable et le titulaire de l’achat. Il consulte ensuite
l’App Store Server API pour obtenir l’état courant et vérifie aussi les JWS
courants de transaction et de renouvellement. Un ancien reçu valable ne peut
ainsi pas réactiver un abonnement remboursé.

Les racines publiques Apple G2/G3 sont embarquées dans `backend/resources/apple`
et copiées dans le build serveur par `metaFiles`. Elles proviennent de
[Apple PKI](https://www.apple.com/certificateauthority/). Les renouveler si Apple
change sa chaîne de certificats ; ne jamais faire confiance au seul `x5c` fourni
par un client. Aucune clé privée n’est stockée dans ces fichiers.

L’app termine la transaction StoreKit uniquement après confirmation du serveur.
En cas d’échec réseau/validation, elle reste inachevée et peut être redélivrée ou
restaurée. Un refus utilisateur ne débloque aucun droit ; un achat en attente
reste en attente de confirmation Apple. Le listener reste monté dans l’app
authentifiée, pas uniquement sur l’écran d’achat.

Les notifications signées sont rapprochées de l’état courant Apple ; la date
signée empêche une mise à jour antérieure de remplacer un état plus récent.
Résiliation : accès maintenu jusqu’à la fin payée. Grâce de facturation : accès
jusqu’à la date de grâce signée. Expiration, révocation, remboursement ou retry
sans grâce : aucun accès. Une notification inconnue ne crée pas de rattachement :
la première synchronisation authentifiée reste indispensable.

La restauration nécessite le compte Garde-manger utilisé lors de l’achat et
le compte Apple propriétaire. Elle ne transfère pas un achat entre deux comptes
Garde-manger. Si le payeur quitte son foyer, le droit de l’ancien foyer est
détaché ; une restauration authentifiée peut le rattacher à son nouveau foyer.
Une notification ultérieure ne réattache jamais un ancien foyer à elle seule.

Pour Stripe, la suppression d’un compte de propriétaire solo demande désormais
l’annulation avant que la cascade de suppression du foyer ne retire sa ligne
d’abonnement.

Supprimer son compte ne peut pas annuler la facturation Apple. Le parcours de
suppression le signale, sans imposer d’annuler avant la suppression. Le compte
Apple permet de résilier même après suppression du compte Garde-manger.

## Déploiement et retour arrière

1. Appliquer la migration additive `1792500000000_create_apple_subscription_table`
   et déployer le backend, ses certificats publics et sa configuration Apple.
   Les anciennes données Stripe sont conservées ; aucune migration n’est exécutée
   automatiquement par ce travail.
2. Configurer les notifications et vérifier le produit dans App Store Connect.
3. Construire une nouvelle build native iOS avec le plugin `expo-iap`, puis
   valider en sandbox/TestFlight sur appareils physiques. Expo Go ne suffit pas.
   La politique `runtimeVersion: fingerprint` sépare ce runtime des anciens
   binaires ; ne pas forcer une OTA StoreKit sur leur ancien runtime.
4. Android/web : vérifier le parcours Stripe et l’absence d’appel natif StoreKit.
5. En cas de problème, retirer la nouvelle offre côté App Store et revenir à une
   UI sans achat, tout en conservant le backend Apple et ses notifications pour
   les abonnements déjà souscrits. Ne pas supprimer la table Apple ou les clés
   tant qu’il existe des abonnements à servir. Revenir à un backend antérieur
   couperait ces droits ; le rollback applicatif doit préserver cette capacité.

## Scénarios à valider avant fusion et soumission

- Achat sandbox sur iPhone et iPad : prix localisé, dialogue Apple natif,
  validation serveur, passage du foyer en abonné sur iOS/web/Android.
- Annulation du dialogue, approbation différée, réseau coupé avant validation,
  fermeture de l’app après paiement et reprise au prochain lancement.
- Restauration après réinstallation, autre appareil, même compte et mauvais
  compte Garde-manger. Aucun droit pour un produit ou un bundle étranger.
- Renouvellement accéléré sandbox, annulation, expiration, grâce, remboursement,
  rejeu de notifications et indisponibilité temporaire de l’API Apple.
- Abonné Stripe sur iOS : accès maintenu sans nouvel achat ; abonné Apple sur
  web/Android : accès maintenu sans checkout Stripe supplémentaire.
- Départ du payeur, restauration dans un nouveau foyer et suppression de compte
  avec abonnement Apple actif.

Ces scénarios ne sont pas déclarés exécutés. Enregistrer appareil/OS/build,
vitrine, environnement Apple, résultat et identifiants non sensibles des
transactions dans le dossier de resoumission. Ne jamais publier les JWS ni les clés.

Références : [expo-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap),
[bibliothèque serveur Apple](https://github.com/apple/app-store-server-library-node),
[runtimes Expo](https://docs.expo.dev/eas-update/runtime-versions/),
[règles Apple 3.1.1 et 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase).
