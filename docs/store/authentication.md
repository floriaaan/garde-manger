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
