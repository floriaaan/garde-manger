# Apple et clés d’accès en production

L’App ID iOS est `com.floriaaan.gardemanger` ; le numéro App Store Connect
`6816469647` sert à la fiche TestFlight, pas à la configuration OAuth.

## Sign in with Apple

1. Dans Apple Developer, activer **Sign in with Apple** et **Associated Domains**
   sur l’App ID `com.floriaaan.gardemanger`. Créer une clé Sign in with Apple
   (`.p8`) et relever son Key ID et le Team ID.
2. Créer un **Services ID** pour le flux web, l’associer à l’App ID et enregistrer
   le domaine `api-gardemanger.floriaaan.fr` et l’URL de retour
   `https://api-gardemanger.floriaaan.fr/api/auth/callback/apple`.
3. Renseigner sur le backend `APPLE_CLIENT_ID` (Services ID),
   `APPLE_APP_BUNDLE_IDENTIFIER=com.floriaaan.gardemanger`, `APPLE_TEAM_ID`,
   `APPLE_KEY_ID` et `APPLE_PRIVATE_KEY` (contenu PEM de la clé `.p8`, avec les
   retours à la ligne conservés). Redéployer le backend. Le secret Apple est
   régénéré à chaque requête.
4. Reconstruire l’application iOS avec EAS : `usesAppleSignIn` est un droit natif,
   une mise à jour OTA ne suffit pas. Tester sur un appareil et avec un Apple ID
   réel. Le backend annonce Apple seulement quand sa configuration est complète.

## Clés d’accès

L’application native propose les clés d’accès uniquement sur le serveur officiel
`https://api-gardemanger.floriaaan.fr`. Ce domaine est le `rpID` WebAuthn et
figure dans l’entitlement iOS `webcredentials:`. Les serveurs personnels
nécessitent leur propre build natif et leurs propres associations de domaine.
Expo Go et les binaires créés avant l’ajout du module natif continuent de
démarrer, mais n’affichent pas l’option clé d’accès. Il faut un nouveau build
de développement ou de distribution pour l’utiliser.

1. Servir l’API officielle sous HTTPS sans rediriger les deux fichiers
   `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json`.
   Le backend les génère depuis les variables ci-dessous. Vérifier un HTTP 200
   et `application/json` pour chacun.
2. Pour iOS, `APPLE_TEAM_ID` et
   `APPLE_APP_BUNDLE_IDENTIFIER=com.floriaaan.gardemanger` alimentent
   `webcredentials.apps` dans le fichier Apple. Recréer le binaire iOS après
   activation de **Associated Domains**.
3. Pour Android, récupérer dans Play Console l’empreinte SHA-256 du certificat
   **App signing** (pas la clé d’upload). Mettre sa valeur hexadécimale avec
   deux-points dans `ANDROID_APP_SIGNING_SHA256` sur le backend. Elle alimente
   `assetlinks.json` et l’origine `android:apk-key-hash:` acceptée par Better Auth.
   Redéployer puis reconstruire le binaire Android.
4. Sur appareil réel, se connecter par e-mail ou Apple, ouvrir **Mon compte**,
   ajouter une clé d’accès, se déconnecter, puis se reconnecter avec elle.
   Vérifier séparément le build iOS TestFlight et le build Android distribué
   par Play, car leurs signatures diffèrent des builds locaux.

Une empreinte Android absente désactive le fichier `assetlinks.json`. Les clés
d’accès existantes restent liées au domaine qui les a créées ; changer de domaine
API demande de les réenregistrer.


## Expo web et redirections OAuth

Le frontend renvoie désormais Google/PocketID vers son origine web après connexion
ou liaison de compte. Ajouter cette origine HTTPS à `CORS_ORIGIN` côté backend.
L’URL du callback enregistrée chez Google/PocketID reste celle de l’API.

Pour les passkeys, configurer **également** `PASSKEY_WEB_ORIGINS` (origines exactes,
séparées par des virgules, sans chemin ni slash final). CORS seul ne suffit pas.
`PASSKEY_RP_ID` reste par défaut le hostname de `NETWORK_URL` : aucune clé native
existante n’est déplacée automatiquement.

Exemple conservant les clés officielles existantes :

```dotenv
NETWORK_URL=https://api-gardemanger.floriaaan.fr
PASSKEY_RP_ID=api-gardemanger.floriaaan.fr
PASSKEY_WEB_ORIGINS=https://web.api-gardemanger.floriaaan.fr
CORS_ORIGIN=gardemanger://,https://web.api-gardemanger.floriaaan.fr
```

Servir le frontend sur cette origine avec HTTPS. Le navigateur impose que son
hostname soit égal au RP ID ou à un sous-domaine de celui-ci. Une origine sœur
comme `app.example.com` avec une API `api.example.com` demande un RP ID commun
`example.com` sur un domaine que l’on contrôle entièrement. **Changer le RP ID
rend les clés existantes inutilisables** : prévoir leur réenregistrement et un
autre moyen de connexion, adapter les domaines associés iOS et servir les fichiers
d’association sur le nouveau domaine avant de reconstruire les apps natives.
Les sous-domaines de ce RP ID doivent rester sous votre contrôle.

Le backend refuse au démarrage les origines web incompatibles et les empreintes
Android mal formées, plutôt que de proposer une cérémonie vouée à échouer.

## Récupération du mot de passe et Docker

Le service backend de `compose.yml` transmet les variables `APPLE_*`,
`ANDROID_APP_SIGNING_SHA256`, `PASSKEY_*` et `SMTP_*` depuis le `.env` de Compose.
Configurer `SMTP_HOST`, `SMTP_FROM` et, si nécessaire, `SMTP_USER`/`SMTP_PASSWORD`.
Le port 587 utilise STARTTLS (`SMTP_SECURE=false`) ; le port 465 utilise TLS direct
(`SMTP_SECURE=true`). Recréer le conteneur backend après modification.

Un lien de récupération est à usage unique ; le changement de mot de passe
révoque les sessions existantes. La réponse reste identique pour une adresse
connue ou inconnue. Tester la livraison SMTP réelle avant d’activer ce parcours
auprès des utilisateurs.

La liaison Apple depuis Mon compte accepte une adresse relais différente de
l’adresse du compte connecté. Elle nécessite toujours une session authentifiée
et une identité Apple vérifiée ; une identité déjà liée ne peut pas être
réattribuée à un autre compte. La fusion implicite avec un compte local dont
l’adresse n’est pas vérifiée reste interdite.
