# Pages introuvables

Les replis utilisent `mobile/src/app/+not-found.tsx` (Expo Router) et le
`notFoundComponent` de la route racine de la landing (TanStack Start SSR).
Ne pas remplacer ce dernier par une route catch-all : le routeur doit conserver
son état « not found » pour que la réponse serveur porte le statut HTTP 404.

## Contrôles ciblés

Avec les dépendances déjà installées :

```sh
cd mobile
pnpm test --runInBand src/presentation/shared/not-found-screen.test.tsx
```

```sh
cd landing
pnpm test src/presentation/not-found/not-found-page.test.tsx
```

## Vérification en conditions réelles

- Mobile : ouvrir `/page-inexistante` depuis la navigation et
  `gardemanger://page-inexistante` au démarrage puis avec l’application ouverte.
  Essayer également `/fridge/absent/route-inexistante`.
  Le titre « Page introuvable » doit apparaître. Le bouton doit revenir à
  l’accueil, puis suivre les règles habituelles : connexion si déconnecté,
  onboarding sans foyer, dashboard avec foyer.
- Vérifier qu’un lien valide `gardemanger://join?code=…` et le partage de PDF
  continuent d’atteindre leurs flux existants.
- Landing : accéder directement à `/page-inexistante`, à une URL imbriquée
  `/chemin/inexistant` et à `/en/page-inexistante`. Vérifier le statut **404** dans
  l’onglet Réseau, puis le retour du bouton vers `/` ou `/en`.
  Sur le serveur SSR démarré :
  `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/page-inexistante`.
  Ne pas utiliser un serveur statique qui réécrit toutes les URLs vers un index 200.
- Responsive : landing à 320, 768 et 1440 px, zoom à 200 % ; mobile sur téléphone
  et tablette, paysage, thème clair/sombre et grande taille de texte.
  Le message et le bouton doivent rester visibles ou accessibles par défilement.
- Accessibilité : un titre annoncé comme en-tête, une action avec un nom clair,
  accès clavier et focus visible sur la landing, VoiceOver/TalkBack sur mobile.
  La mascotte est décorative. Le bouton mobile mesure au moins 48 points et
  grandit avec le texte ; les couleurs viennent des palettes existantes.

## Limite de la vérification dans ce worktree

Les commandes `task mobile:check` et `task landing:check` passent localement.
La landing exécute 9 tests ; les 4 tests mobiles ciblés ci-dessus passent aussi
(les tests mobiles sont actuellement désactivés dans `mobile:check`).
Le test landing vérifie l’état « not found » du routeur, pas une réponse HTTP.
Les captures sur appareils et les requêtes au serveur SSR n’ont pas été exécutées.
La revue statique couvre les safe areas, le défilement, les thèmes, la sémantique
et les règles CSS responsive ; elle ne confirme pas le statut HTTP servi par
un déploiement ni le rendu sur appareil.
