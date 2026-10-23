# Validation locale de la PR #112

Validation demandée explicitement le 21 octobre 2026. Aucun simulateur ni
émulateur lancé. Aucun déploiement ou accès à une base de production.

## Résultats

| Contrôle | Résultat |
| --- | --- |
| Backend : `pnpm --filter garde-manger-backend run build` | Réussi |
| Backend : migrations puis `node ace.js test` sur PostgreSQL temporaire isolé | 452 tests réussis |
| Landing : `pnpm --filter garde-manger-landing run test` | 9 tests réussis |
| Landing : `pnpm --filter garde-manger-landing run build` | Réussi, client et SSR |
| Mobile : `pnpm --filter garde-manger-mobile run typecheck` | Réussi après correction du code d’erreur StoreKit optionnel |
| Mobile : `pnpm --filter garde-manger-mobile run test --runInBand` | Échec : 25 suites / 94 tests en échec, 68 suites / 499 tests réussis, avant corrections ciblées |
| Mobile : relance ciblée après corrections | 9 suites / 56 tests réussis |
| Expo : `expo export --platform web` | Réussi |
| Expo : `expo export --platform ios --max-workers 2` | Réussi, bundle Hermes |
| Expo : `expo export --platform android --max-workers 2` | Réussi, bundle Hermes |
| iOS natif : Xcode Debug, SDK `iphoneos`, cible générique appareil, signature désactivée | `BUILD SUCCEEDED` |

## Tests mobile ciblés

Commande : `pnpm --filter garde-manger-mobile run test --runInBand --silent --runTestsByPath`
avec les fichiers suivants :

- `src/application/settings/apple-subscription-context.test.tsx`
- `src/presentation/settings/billing-availability.test.tsx`
- `src/presentation/settings/subscription-route.test.tsx`
- `src/presentation/identity/account-screen.test.tsx`
- `src/presentation/identity/delete-account-route.test.tsx`
- `src/presentation/fridge/barcode-scanner-screen.test.tsx`
- `src/presentation/receipt/receipt-scanner-screen.test.tsx`
- `src/domain/shared/platform-capabilities.test.ts`
- `src/presentation/identity/google-availability.test.tsx`

Trois suites en échec ont été corrigées : assertions d’accessibilité des boutons
d’abonnement et fournisseur SafeArea manquant dans le test de confirmation de
suppression. Le typage de l’erreur native StoreKit accepte désormais l’absence
de code. Le schéma Lucid de la nouvelle table Apple a été généré lors des migrations.

La suite mobile complète reste en échec et n’a pas été relancée intégralement.
Trois suites hors périmètre ont été exécutées également sur la base avant PR
(`8d9def66`) avec les mêmes dépendances installées : `fake-fridge-connector`,
`avatar` et `wire-focus-manager`. Leurs cinq échecs se reproduisent : état du
job `running` au lieu de `queued`, thème manquant, gestion du focus web.
Ce contrôle partiel ne permet pas d’attribuer tous les autres échecs à la base.

Commande native exécutée depuis `mobile/ios` après prébuild Expo et installation
des pods :

```sh
xcodebuild -workspace Gardemanger.xcworkspace -scheme Gardemanger \
  -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' \
  -jobs 2 -derivedDataPath /tmp/fridge-112-ios-device-build \
  CODE_SIGNING_ALLOWED=NO build
```

Ce résultat valide la compilation des modules natifs, notamment StoreKit. Il ne
constitue ni une archive de distribution signée ni une exécution sur appareil.

Le build natif Android n’a pas été exécuté : aucun SDK Android installé dans
cet environnement. L’export JavaScript Android a été validé.

## Validation physique encore nécessaire

Les exports et la compilation ne prouvent pas un achat réel. La configuration
App Store Connect, les achats/restaurations sandbox sur iPhone/iPad et la vidéo
de suppression restent à réaliser selon [le protocole de resoumission](app-store-resubmission.md).

## Correction des jobs CI — 23 octobre 2026

Le [run 39509680715](https://github.com/floriaaan/garde-manger/actions/runs/39509680715)
s’arrêtait au lint sur les deux jobs, avant leurs étapes suivantes :

- Backend : 116 erreurs de formatage et deux accès directs au résultat d’un
  `await`. Formatage des fichiers concernés et variables intermédiaires dans les
  deux tests, sans changement de comportement backend.
- Mobile : `react-hooks/set-state-in-effect` sur la remise à zéro StoreKit.
  L’état est désormais réinitialisé avant rendu lorsque le compte, le foyer,
  le serveur ou la tentative change. Aucun contournement de règle ESLint.

Contrôles locaux après correction : lint backend réussi ; lint mobile réussi
avec 31 avertissements ; typecheck et frontières de dépendances réussis sur
les deux projets. Les cinq tests du contexte StoreKit passent, dont une
régression sur la remise à zéro lors d’une nouvelle tentative. Les neuf tests
backend ciblés Apple Store et synchronisation passent également sur PostgreSQL
temporaire isolé.

Ces corrections ne rendent pas verte la suite Jest mobile complète, qui reste
hors des étapes exécutées par `task mobile:check` (désactivée dans le Taskfile
existant). Aucun simulateur lancé et aucun build natif relancé.
