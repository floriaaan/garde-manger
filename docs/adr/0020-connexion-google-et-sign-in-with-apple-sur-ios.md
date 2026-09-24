# ADR-0020 — Connexion Google masquée sur iOS, Sign in with Apple en préparation

## Contexte

L'instance peut proposer trois méthodes de connexion en plus de l'e-mail : PocketID
(`genericOAuth`), Google (`socialProviders.google`) et les clés d'accès. Le backend ne
les annonce que si elles sont configurées (`EnvAuthMethodsProvider`,
`backend/src/infrastructure/auth/auth-methods.provider.ts`), et l'app les liste via
`useAuthMethodsQuery`, à la connexion (`AuthMethodFooter`) comme à la liaison de compte
(`AccountScreen`).

La règle 4.8 de l'App Store (*Login Services*) : une app qui propose une connexion via un
service tiers (Google, Facebook…) pour le compte principal doit aussi proposer un service
équivalent qui limite les données collectées au nom et à l'e-mail, permet de masquer
l'e-mail et ne sert pas à la publicité. En pratique : Sign in with Apple. La règle ne
s'applique pas au système de comptes propre à l'app (e-mail et mot de passe, clés
d'accès).

Sign in with Apple demande un compte Apple Developer (App ID avec la capacité, Services
ID, clé `.p8`), que le projet n'a pas encore.

## Décision

- **Pas de Google sur iOS en v1.** `capabilitiesFor(os).googleSignIn` vaut `false` sur iOS
  (`mobile/src/domain/shared/platform-capabilities.ts`), avec le même mécanisme que la
  facturation (ADR-0019) : décidé une fois, jamais de `Platform.OS` dans un écran.
- **Filtré à un seul endroit.** `useAuthMethodsQuery`
  (`mobile/src/application/identity/auth-methods.query.ts`) retire `google` de la liste
  quand la capacité est absente. La connexion, l'inscription et la liaison de compte lisent
  toutes cette requête : aucune ne peut afficher Google par erreur.
- **Backend inchangé.** Google reste annoncé et utilisable sur Android et le web. Un
  compte créé avec Google ailleurs n'a, sur iPhone, que les autres méthodes déjà liées à
  ce compte.

## Plan pour Sign in with Apple

Le backend est câblé et attend seulement les identifiants Apple Developer (étape 1) pour
s'activer ; la partie mobile reste à faire. Remettre `googleSignIn` à `true` sur iOS une
fois Sign in with Apple utilisable en pratique (étapes 1 et 3 terminées).

1. **Apple Developer** (bloquant, pas encore fait — pas de compte)
   - App ID `com.floriaaan.gardemanger` : cocher la capacité *Sign in with Apple*.
   - Créer un *Services ID* (ex. `com.floriaaan.gardemanger.signin`) pour le web et
     Android, avec le domaine de l'API et l'URL de retour
     `https://<API_URL>/api/auth/callback/apple`.
   - Créer une clé *Sign in with Apple* (`.p8`) : noter le Key ID et le Team ID.
2. **Backend — fait** (`backend/src/infrastructure/auth/better-auth/instance.ts`,
   `apple-client-secret.ts`)
   - Le provider `apple` est ajouté à `socialProviders`, activé seulement si les quatre
     variables ci-dessous sont renseignées, comme Google.
   - `clientId` : le Services ID (`APPLE_CLIENT_ID`). `appBundleIdentifier`
     (`APPLE_APP_BUNDLE_IDENTIFIER`) : le bundle id iOS, pour accepter les ID tokens émis
     par l'app native.
   - `clientSecret` : un JWT ES256 signé avec la clé `.p8`, généré au démarrage par
     `buildAppleClientSecret` (Team ID en `iss`, Key ID en `kid`, durée 6 mois) plutôt que
     stocké, pour ne pas expirer en silence. Testé par
     `tests/infrastructure/auth/apple-client-secret.spec.ts`.
   - `https://appleid.apple.com` est dans `trustedOrigins` (inconditionnellement : ne
     coûte rien tant que le provider n'est pas actif).
   - Variables (`start/env.ts` et `.env.example`) : `APPLE_CLIENT_ID`,
     `APPLE_APP_BUNDLE_IDENTIFIER`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
     (contenu de la `.p8`).
   - `EnvAuthMethodsProvider` annonce `{ id: 'apple', label: 'Apple' }` dès que les quatre
     variables sont présentes ; `apple` fait partie de `AuthMethodId`
     (`auth-method.vo.ts`).
3. **Mobile — pas commencé**
   - Installer `expo-apple-authentication` et l'ajouter aux `plugins`. Mettre
     `ios.usesAppleSignIn: true` dans `app.json`, ce qui ajoute l'entitlement.
   - Sur iOS, flux natif : `AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME,
     EMAIL] })`, puis `authClient.signIn.social({ provider: 'apple', idToken: { token:
     credential.identityToken } })`. Pas de navigateur.
   - Utiliser `AppleAuthentication.AppleAuthenticationButton` : Apple impose son style. Le
     placer au-dessus de Google, ou au même niveau.
   - Ajouter `appleSignIn` aux capacités (`true` sur iOS). Sur Android et le web, garder
     le flux par redirection seulement si l'on veut Apple partout.
   - Apple ne transmet le nom qu'à la première autorisation. L'enregistrer à ce moment-là.
4. **Suppression de compte** (règle 5.1.1(v)) : à la suppression, révoquer le jeton Apple
   (`https://appleid.apple.com/auth/revoke`).

## Conséquences

- La build iOS ne propose que l'e-mail, PocketID (si l'instance le configure) et les clés
  d'accès. Ce sont des comptes de l'instance, pas un service tiers grand public. PocketID
  est un fournisseur OIDC auto-hébergé : il reste un risque de lecture de la règle 4.8 si
  l'instance officielle l'active.
- Un utilisateur dont le compte n'est lié qu'à Google ne peut pas se connecter sur iPhone
  tant que Sign in with Apple n'existe pas. Il doit d'abord lier une autre méthode
  (PocketID, clé d'accès) depuis un autre appareil.
- Voir aussi ADR-0019 pour le même mécanisme de capacités.
