# Checklist — première publication iOS

Tout ce qui ne dépend pas d'un compte Apple est déjà fait sur la branche
`chore/ios-release-prep` : version 1.0.0, ATS, textes de permission, iPad, pas
de facturation ni de Google sur iOS, profil EAS et workflow, compte de démonstration.
Reste la liste ci-dessous, dans l'ordre.

## 1. Avant le compte Apple (bloquant pour la review)

- [x] **Page /privacy à jour.** Les 8 écarts listés dans `app-privacy.md` sont corrigés
      (télémétrie, cookies, push Expo, Open Food Facts, fournisseur IA — Gemini en
      production —, Home Assistant, clés d'accès, lien dans l'app).
- [x] **Fournisseur IA de production vérifié** : Gemini sur le serveur officiel
      (`AI_PROVIDER=gemini`), et la page /privacy le reflète. Si le serveur officiel
      change de fournisseur, remettre à jour `landing/src/presentation/legal/privacy-page.tsx`.
- [x] **Accès au debug caché** restreint à `__DEV__`, sur le tap et sur la route.
- [x] **Texte « bientôt, hébergé par nous »** retiré : le serveur officiel existe.
- [x] **Dépendances natives.** `expo-constants` remonté à `~57.0.19` (dernier patch SDK
      57) dans `mobile/package.json`. Le doublon `react` (19.2.3 dans `mobile`, requis
      par le SDK 57, contre 19.3.0 dans `landing`) est réglé en fixant `landing` sur
      `19.2.3` aussi : `landing` n'est pas une app Expo, rien ne l'oblige à une version
      plus récente. Pas de bump du SDK Expo lui-même (57 reste la cible). **Reste à
      faire** : `pnpm install` pour régénérer le lockfile, puis `npx expo-doctor` pour
      confirmer que les 17 paquets sont désormais à jour, et une build Android pour
      vérifier l'absence de régression.
- [x] **Auto-hébergement en HTTP public documenté.** ATS bloque le HTTP simple hors
      réseau local sur iOS ; `README.fr.md` (section HTTPS) explique la limite et
      renvoie au reverse proxy déjà documenté juste au-dessus.
- [x] **Règle 3.1.3(b).** Un foyer abonné (ou libre) sur iOS n'a ni paywall ni portail de
      gestion in-app, mais un texte et un lien (non intrusif) vers
      `gardemanger.floriaaan.fr` pour s'abonner ou gérer l'abonnement dans un navigateur
      (`mobile/src/presentation/settings/ai-access-cards.tsx`,
      `ExternalSubscriptionNotice`).
- [x] **Passage sur iPad** : l'app est proposée sur iPad, avec la barre latérale au lieu
      des onglets natifs. Reste à parcourir chaque écran sur le simulateur iPad, en
      portrait, en paysage et en Split View étroite, avant la build de production —
      cela n'a encore été vérifié que par lecture du code.

## 2. Compte Apple Developer

- [ ] S'inscrire au programme (99 €/an). Pour publier sous un nom d'entreprise, il faut
      un numéro D-U-N-S.
- [ ] Accepter les accords dans App Store Connect > *Business*. Pour une app gratuite, les
      informations bancaires et fiscales ne sont pas nécessaires.
- [ ] Créer l'app dans App Store Connect : nom « Garde-manger », langue principale
      français, bundle id `com.floriaaan.gardemanger`, SKU libre.
- [ ] Noter l'**Apple ID de l'app** (*App Information*, nombre à 10 chiffres).

## 3. Configuration du dépôt

- [ ] `mobile/eas.json` : remplacer `REMPLACER_PAR_L_APPLE_ID_DE_L_APP` par l'Apple ID de
      l'app (`submit.production.ios.ascAppId`).
- [ ] Première build **interactive** depuis un poste, qui crée et stocke sur EAS le
      certificat de distribution, le profil de provisionnement et la clé API App Store
      Connect :

      ```bash
      cd mobile
      eas build -p ios --profile production --auto-submit
      ```

      Répondre « oui » à la génération de la clé API ASC. La build part ensuite sur
      TestFlight.
- [ ] Créer un token sur expo.dev (*Account settings > Access tokens*) et l'ajouter comme
      secret `EXPO_TOKEN` sur GitHub. Le workflow `.github/workflows/eas-release.yml`
      publie alors chaque tag de release sans intervention.

## 4. Serveur officiel

- [ ] Définir `REVIEW_ACCOUNT_EMAIL` et `REVIEW_ACCOUNT_PASSWORD` dans le `.env`.
- [ ] Lancer `node ace seed:review-account`, reporter l'id du foyer affiché dans
      `AI_QUOTA_EXEMPT_HOUSEHOLD_IDS`, redémarrer le backend.
- [ ] Vérifier que `DISABLE_PASSWORD_LOGIN` n'est pas actif (le reviewer se connecte par
      e-mail et mot de passe).
- [ ] Vérifier que l'API répond en HTTPS avec un certificat valide (ATS).

## 5. Fiche App Store Connect

- [ ] Textes : `listing.fr.md`.
- [ ] Captures iPhone 6,9" et iPad 13" : `screenshots.md`.
- [ ] Questionnaire *App Privacy* : `app-privacy.md`.
- [ ] URL de confidentialité : `https://gardemanger.floriaaan.fr/privacy`.
- [ ] URL d'assistance : une page accessible avec un moyen de contact
      (`garde-manger@floriaaan.fr`).
- [ ] Classification d'âge : questionnaire, tout à « non », soit 4+.
- [ ] *App Review Information* : compte et notes de `review-notes.md`, relancer le seed
      le jour même.
- [ ] Prix : gratuit. Disponibilité : France, puis les autres pays francophones si
      voulu (la fiche n'existe qu'en français).
- [ ] Export compliance : rien à faire, `ITSAppUsesNonExemptEncryption: false` est déjà
      dans `app.json` (chiffrement standard HTTPS uniquement).

## 6. Après publication

- [ ] Renseigner `APP_UPDATE_URL` (`https://apps.apple.com/app/id<ascAppId>`) dans
      `mobile/src/application/shared/server-config.ts`. C'est l'URL proposée quand
      l'instance est plus récente que l'app. Elle est commune à toutes les plateformes :
      utiliser `Platform.select` si Android a une fiche Play Store.
- [ ] Sign in with Apple, puis réactiver Google sur iOS : plan dans ADR-0020. Le backend
      est déjà câblé (provider `apple`, secret JWT généré au démarrage) ; reste l'étape 1
      (compte Apple Developer) et l'étape 3 (paquet mobile, bouton, capacité).
