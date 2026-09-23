# Captures d'écran App Store

Une seule taille est obligatoire : **iPhone 6,9"**, **1320 × 2868** en portrait. Apple
réduit ces captures pour les autres iPhone. L'app n'est pas proposée sur iPad
(`supportsTablet: false`) : aucune capture iPad à fournir.

Entre 1 et 10 captures sont acceptées ; en voici 6. Les trois premières apparaissent
dans les résultats de recherche : ce sont elles qui comptent.

## Préparer les données

1. Sur le serveur officiel, lancer `node ace seed:review-account` le jour même (voir
   `review-notes.md`). Le foyer « Maison Martin » a alors des produits qui périment dans
   1 à 3 jours, un historique et une liste de courses. Le foyer doit être dans
   `AI_QUOTA_EXEMPT_HOUSEHOLD_IDS` pour que la jauge de quota IA ne s'affiche pas.
2. Simulateur **iPhone 17 Pro Max** (ou 16 Pro Max), qui fait 1320 × 2868 en natif.
   Build de dev ou de preview pointant sur le serveur officiel, connectée avec le compte
   de démonstration.
3. Barre d'état propre :

   ```bash
   xcrun simctl status_bar booted override --time 9:41 --batteryState charged \
     --batteryLevel 100 --cellularBars 4 --wifiBars 3
   ```

4. Pour le scan de ticket, la caméra n'existe pas sur le simulateur. Ajouter une photo de
   ticket réel à la photothèque (`xcrun simctl addmedia booted ticket.jpg`), puis passer
   par « Choisir une photo dans la galerie ».
5. Capture : `xcrun simctl io booted screenshot 01-dashboard.png`. Vérifier la taille
   avec `sips -g pixelWidth -g pixelHeight 01-dashboard.png`.

Mode clair pour toutes les captures, pour qu'elles restent cohérentes. Pas de données
personnelles réelles : uniquement le foyer de démonstration.

## Les 6 écrans

| # | Écran | Route | Ce qu'on doit voir | Accroche (optionnelle, en surimpression) |
|---|---|---|---|---|
| 1 | Tableau de bord | `(tabs)/index` | Produits qui périment bientôt en tête, compteurs du foyer | Voyez ce qui périme avant qu'il soit trop tard |
| 2 | Revue d'un ticket scanné | `receipts/scan` puis `receipts/review` | Liste des articles reconnus avec leurs dates estimées, avant validation | Un ticket scanné, le frigo rempli |
| 3 | Recette générée | `(tabs)/recipes/generate` puis `(tabs)/recipes/[id]` | Recette qui utilise les produits qui périment, bouton « Ajouter … à la liste de courses » | Cuisinez ce qu'il faut finir |
| 4 | Frigo | `(tabs)/fridge/index` | Liste complète, statuts de péremption colorés | Tout le frigo, pour toute la maison |
| 5 | Liste de courses | `(tabs)/shopping-list/index` | 5 articles, dont un coché | Une liste de courses commune |
| 6 | Statistiques | `stats` | Consommé ou jeté sur la période, à partir de l'historique seedé | Suivez ce que vous gaspillez vraiment |

À éviter dans les captures :

- tout écran de facturation ou d'abonnement (il n'existe pas sur iOS, mais ne pas
  prendre de capture depuis Android ou le web) ;
- l'écran « Choisis ton serveur » et toute URL de serveur ;
- le bouton Google (absent sur iOS) ou toute mention d'Android.

## Accroches

Les accroches en surimpression sont facultatives. Si on en met, les composer en dehors
de l'app (Figma, Keynote) à 1320 × 2868, avec la capture réduite dans un cadre d'iPhone.
Le texte doit décrire une fonction réellement visible dans la capture (règle 2.3.7).
