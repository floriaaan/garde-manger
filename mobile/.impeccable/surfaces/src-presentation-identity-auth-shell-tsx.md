---
version: 1
slug: "src-presentation-identity-auth-shell-tsx"
primary_target: "src/presentation/identity/auth-shell.tsx"
related_targets: ["src/presentation/identity/auth-entry-screen.tsx", "src/presentation/identity/auth-screen-chrome.tsx", "src/presentation/identity/auth-provider-button.tsx", "src/presentation/onboarding/threshold-screen.tsx", "src/app/welcome.tsx"]
---

Scope : authentification, accueil, serveur et onboarding du foyer. Mode : Operate.
Brief UX validé : inscription courte, serveur modifiable, méthodes dynamiques, invitations préservées et découverte facultative.

## Direction contract

THESIS: Garden fait entrer dans un espace partagé ; présentation et création du compte se trouvent sur un même écran, sans carrousel.

OWN-WORLD: la maquette `gardens.png` reste l’autorité de composition reconnaissable : large aplat organique, titre condensé et nature morte photographique. La première adaptation menthe pâle/petite carotte 3D/pilules a été rejetée. La dernière consigne utilisateur conserve ce design/layout et adapte uniquement les couleurs à `mobile/DESIGN.md`, avec fournisseurs en une rangée et sans ScrollView. `gardenColors` réutilise exclusivement `cream`, `blobStrong`, `ink`, `inkSecondary`, `accentLime` et `accentLimeText`, dans les deux thèmes. Aucun nouveau token de couleur.

FORM: en-tête plein bord sur téléphone ; colonne mesurée pour le titre Anton (`min(58, (heroWidth - 52) / 6.1)`, compact 38), mot-symbole Jakarta, contrôles arrondis à 11px, champs transparents à contour. Le cadre natif fixe utilise `KeyboardAvoidingView` et `View`, sans ScrollView. Il mesure cadre et formulaire ; l’image prend la hauteur restante, et un petit bandeau de marque remplace le hero quand l’espace manque. À partir de 768px, composition en deux colonnes bornée à 1040px. Le clavier masque hero et accessoires secondaires, en conservant les formulaires montés. La saisie reste ancrée juste au-dessus du clavier ; toucher hors du champ ferme le clavier. La touche Terminé du code d’invitation libère explicitement le focus sans effacer le code. Cette adaptation au manque de hauteur n’est pas une promesse de pixel-match sur petit écran ou en grande taille de texte.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

STORY: choisir son accès, saisir seulement le nécessaire, créer ou rejoindre son foyer, entrer. Serveur actif visible ; aucune promesse de confidentialité inventée.

FIRST VIEWPORT: en-tête Garden, puis méthodes de connexion en une seule rangée horizontale de boutons avec vrai logo, nom court visible, libellé accessible complet et spinner pendant la requête. Apple conserve `signInAsync` et son logo officiel existant, sans bouton visuel natif. L’action e-mail est séparée ; liens d’intention et serveur en ligne. Une instance à mot de passe seul ouvre directement le formulaire sous le grand hero ; un choix e-mail explicite réduit l’en-tête. Le clavier masque le hero, l’introduction et les liens/accessoires ; les formulaires restent montés et leurs espacements se réduisent. Largeur de contenu auth : 440px.

## Comportements conservés

Accueil et méthodes réunis, bascule connexion/inscription explicite, formulaire e-mail sans pager, mot de passe visible à la demande, autofill et progression clavier. Seules les méthodes activées et compatibles sont proposées ; états de chargement, absence de méthode, erreurs et réessai conservés. Les formulaires cachés conservent les brouillons et quittent l’arbre d’accessibilité.

URL enregistrée prioritaire ; sinon `EXPO_PUBLIC_API_URL` prime sur le serveur officiel. Le détour serveur revient à l’intention initiale ; sauvegarder le même serveur conserve les brouillons. Les actions de méthode, mode et serveur sont bloquées pendant l’authentification. Invitations et gates session/foyer restent en place ; la visite est facultative et désactivée par défaut.

## Réalisation et revue

Disposition indépendante : **RECAPTURE**, pas de verdict ship. Les deux tentatives de capture native ont été bloquées par les permissions de contrôle de l’ordinateur. La revue des sources a identifié une taille de titre calculée depuis le viewport tablette ; elle est maintenant calculée depuis la colonne mesurée par `onLayout`. La fidélité visuelle au comp, le clavier, les petits écrans, les grandes tailles de texte et le rendu sombre/tablette restent à vérifier sur captures natives. Les aperçus de composants et l’inspection statique ne les valident pas. Aucun test, build, lint ou typecheck exécuté conformément à AGENTS.md.

Asset : `assets/illustrations/garden-harvest.png`, nature morte photographique générée de carottes et poire sur fond transparent ; prompt conservé dans `.impeccable/mocks/decision/garden-harvest.prompt.txt` et dans les métadonnées du PNG. La petite carotte 3D de l’ancienne adaptation n’est plus le visuel du hero. Anton est embarquée dans `assets/fonts/Anton-Regular.ttf` ; le mot-symbole charge localement le fichier Plus Jakarta Sans 800 existant. Les polices ordinaires de l’application restent inchangées.

## Adaptation aux faibles hauteurs

Le cadre transmet sa hauteur mesurée aux formulaires. Inscription : un champ à la fois sous `(clavier ? 470 : 740) × fontScale` ; connexion : sous `(clavier ? 410 : 560) × fontScale`. Une hauteur encore inconnue (0) ou suffisante conserve le formulaire complet. Les champs restent montés avec leurs valeurs, refs et mutations ; les champs inactifs sont masqués. « Continuer » avance jusqu’au mot de passe, puis l’action habituelle soumet. Un retour de 44px minimum permet de revenir ; le focus suit l’étape après rendu lorsque le clavier est ouvert. L’indicateur de force se masque au clavier, mais l’aide de longueur du mot de passe reste présente à cette étape. Deux tests ciblés couvrent étapes compactes, brouillons et soumission ; ils n’ont pas été exécutés.

Au seuil foyer, le clavier masque aussi le sélecteur créer/rejoindre, les explications, collage/scan, visite et changement de compte ; le champ actif et son action restent visibles. Le hero invalide ses mesures sur changement de largeur, taille du texte, mode compact, titre, sous-titre ou chargement des polices, afin de recalculer le repli en bandeau. Ces adaptations nécessaires au cadre sans défilement ne constituent pas un pixel-match garanti sur petits écrans ; la disposition reste **RECAPTURE**.
