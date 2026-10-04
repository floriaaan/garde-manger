# ADR-0021 — Sheets natives et états partagés des recettes

## Décisions

Les sheets custom de confirmation passent par `ActionSheet`. Sur iOS et Android,
Metro choisit `action-sheet.native.tsx`, qui présente une route Expo Router
`formSheet` à travers le native stack et `react-native-screens` déjà installés.
Le système gère la présentation, les detents, le voile et la fermeture gestuelle.
Deux hauteurs (50 % et 90 %) permettent de lire les actions et les formulaires longs.
Le contenu défile ; le clavier iOS est compensé et Android utilise le redimensionnement
natif. Une safe area protège le bas. Annuler et l’échappement d’accessibilité ferment
la sheet ; le retour Android et le geste natif réinitialisent l’état de son écran.
Les changements d’étape gardent la même présentation. Aucun callback ni contenu
React ne transite dans les paramètres de navigation : seul un identifiant de session
y figure. Les callbacks sont éphémères et restent dans le processus.

Le web garde `action-sheet.web.tsx` et ses comportements existants. Les lignes
et leurs libellés accessibles sont communs. Aucune dépendance n’est ajoutée.

Références : [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Expo Router Stack et formSheet](https://docs.expo.dev/router/advanced/stack/).

**Favori et épinglage sont une seule action**, partagée par tous les membres du
foyer, conformément à PRODUCT.md. Un favori monte en tête de bibliothèque.
À priorité égale, les recettes les plus récentes viennent d’abord. Le filtre
Favoris affiche les favoris non archivés. Les suggestions « Ce soir », visibles dans la collection Recettes, gardent
leur ordre fondé sur les produits à sauver, et excluent toutes les archives.

**L’archivage est réversible** et partagé dans le foyer. Le filtre Archives donne
accès aux recettes archivées et à leur détail ; Désarchiver les remet dans la
bibliothèque. Archiver préserve ingrédients, historique de cuisine et favori.
La suppression permanente est une action destructive séparée, avec une seconde
étape explicite ; elle n’est jamais déclenchée par l’archivage.

`is_archived` et `is_favorite` sont deux colonnes booléennes avec défaut false.
`PATCH /api/recipes/:id/state` modifie uniquement les colonnes fournies, en
filtrant recette et foyer dans l’écriture SQL. Les listes et détails restituent
les deux états. Le mobile met à jour leurs caches après succès, et conserve
l’état précédent en cas d’échec. Un ancien serveur qui n’expose pas ces champs
reste lisible ; les nouvelles actions requièrent le backend mis à jour.

## Inventaire des sheets custom migrées

| Écran / composant | Contenu conservé |
| --- | --- |
| `fridge-list-screen` et `fridge-detail-screen` via `ProductExitSheet` | Consommé, jeté, correction ; motif et quantité facultatifs |
| `fridge-form-screen` | Abandon de saisie |
| `shopping-list-screen` | Actions sur une ligne, suppression |
| `recipe-list-screen` et `recipe-detail-screen` | Menu d’actions, confirmation destructive |
| `recipe-detail-screen` | Confirmation de cuisine et consommation des produits |
| `recipe-generate-screen` | Abandon ou effacement des choix |
| `household-screen` | Retrait de membre, choix du successeur, départ du foyer |
| `settings-screen` | Déconnexion |
| `home-assistant-screen` | Dissociation |
| `debug-screen` | Confirmation des actions de diagnostic |

`scan-sheet.tsx` est un helper de navigation, sans sheet custom. Scanner,
génération de recettes, ajout aux courses et scans de produits/tickets/frigo
utilisent déjà le native stack en présentation modale ; ils sont conservés.
La `Modal` de `fridge-scan-review-screen` est une visionneuse photo plein écran,
pas une bottom sheet.

## Déploiement et validation restante

Appliquer la migration `1785200000028_add_recipe_states` avant de déployer
le backend et le mobile. Son rollback retire uniquement les deux colonnes d’état.
La migration n’a pas été exécutée pendant cette implémentation.

Tests ajoutés : persistance par relecture API, isolation entre foyers, validation
et réversibilité des états, favori conservé pendant un archivage, suppression
permanente, filtres et ordre de bibliothèque, échec réseau, cycle de présentation
natif et fermeture tardive d’une ancienne session. Les tests d’écran rendent le
contenu web en ligne ; des tests dédiés au composant natif et à son store
couvrent les changements d’étape et le cycle de navigation natif.
Aucun test, build, lint ni typecheck exécuté (politique AGENTS.md).

À vérifier sur appareils iOS et Android, puis sur web :

- Ouvrir chaque entrée de l’inventaire ; Annuler, toucher hors sheet, geste,
  retour Android ; rouvrir et vérifier l’étape initiale.
- Depuis un modal existant (génération, scans), ouvrir une confirmation,
  annuler puis confirmer ; contrôler la destination et le garde de saisie.
- Choix du successeur avec un foyer long, motif/quantité jetée et grandes
  tailles de texte : défilement et agrandissement de la sheet.
- Clavier déjà ouvert dans un formulaire : champs, boutons visibles, retour,
  fermeture et réouverture ; portrait et paysage, safe areas.
- VoiceOver/TalkBack : titre, actions, avertissement destructif, Annuler,
  confinement dans la sheet et retour du focus au contrôle d’ouverture.
- Archiver/désarchiver, favoriser/retirer, relancer l’application et vérifier
  listes, détail, Archives et Favoris ; rafraîchir sur le téléphone d’un
  second membre du même foyer.
- Web : mêmes actions, voile, Annuler, clavier, lecture et défilement.
