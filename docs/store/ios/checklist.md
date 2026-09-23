# Checklist — première publication iOS

Tout ce qui ne dépend pas d'un compte Apple est déjà fait sur la branche
`chore/ios-release-prep` : version 1.0.0, ATS, textes de permission, iPad, pas
de facturation ni de Google sur iOS, profil EAS et workflow, compte de démonstration.
Reste la liste ci-dessous, dans l'ordre.

## 1. Avant le compte Apple (bloquant pour la review)

- [ ] **Page /privacy à jour.** Corriger les 8 écarts listés dans `app-privacy.md`
      (télémétrie, cookies, push Expo, Open Food Facts, fournisseur IA, Home Assistant,
      clés d'accès, lien dans l'app).
- [ ] **Fournisseur IA de production vérifié** (`AI_PROVIDER` sur le serveur officiel)
      et cohérent avec la page /privacy.
- [ ] **Accès au debug caché.** Trois appuis sur le logo de l'écran de connexion
      (`mobile/src/presentation/identity/auth-wordmark.tsx`) ouvrent `/debug` en build
      de production, avec « Réinitialiser l'application ». Une fonction cachée est un
      motif de rejet (règle 2.3.1) : restreindre à `__DEV__` ou à la preview.
- [ ] **Texte « bientôt, hébergé par nous »** de l'écran « Choisis ton serveur »
      (`mobile/src/presentation/onboarding/server-choice-screen.tsx`) : le serveur
      officiel existe et c'est lui que la fiche présente. Un « bientôt » peut être lu
      comme une fonction inachevée (règle 2.1).
- [ ] **Dépendances natives.** `npx expo-doctor` signale 17 paquets en retard de patch
      SDK 57 et des modules natifs en double (`expo-constants` 57.0.15 et 57.0.19,
      `react` 19.2.3 et 19.3.0, à cause de `landing`). Lancer
      `npx expo install --check` dans `mobile/` et aligner `react` entre `landing` et
      `mobile`, puis refaire une build Android pour vérifier.
- [ ] **Passage sur iPad.** L'app n'a jamais tourné sur un iPad. Parcourir chaque écran
      sur le simulateur iPad, en portrait, en paysage et en Split View étroite (où la
      barre du bas remplace la barre latérale). Apple teste l'app sur iPad dès que
      `supportsTablet` est actif.

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
- [ ] Sign in with Apple, puis réactiver Google sur iOS : plan dans ADR-0020.
