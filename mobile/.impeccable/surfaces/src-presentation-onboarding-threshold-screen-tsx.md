---
version: 1
slug: "src-presentation-onboarding-threshold-screen-tsx"
primary_target: "src/presentation/onboarding/threshold-screen.tsx"
related_targets: ["src/presentation/onboarding/invite-code-field.tsx", "src/presentation/onboarding/first-run-tour.tsx", "src/presentation/identity/auth-screen-chrome.tsx"]
---

Scope : le seuil créer/rejoindre, le scan QR et la visite facultative du vrai dashboard. Mode : Operate.
Audience : fondateur qui nomme son foyer, rejoignant qui possède déjà un code ou une invitation.
Contraintes : contrats backend existants (`POST /api/households`, `POST /api/households/join`, code `^[A-Z0-9]{8}$`), gates session et foyer conservés. Pas d’universal link : partage par schéma `gardemanger://` et code lisible. Aucun remplissage ni premier scan obligatoire.

## Direction contract

THESIS: l’onboarding est un seuil franchi, pas un couloir traversé : créer ou rejoindre, puis entrer dans le vrai garde-manger.

OWN-WORLD: la maquette `gardens.png` reste l’autorité de composition reconnaissable : large aplat organique, titre condensé et nature morte photographique. La première adaptation menthe pâle/petite carotte 3D/pilules a été rejetée. La dernière consigne utilisateur conserve ce design/layout et adapte uniquement les couleurs à `mobile/DESIGN.md`, avec fournisseurs en une rangée et sans ScrollView. `gardenColors` réutilise exclusivement `cream`, `blobStrong`, `ink`, `inkSecondary`, `accentLime` et `accentLimeText`, dans les deux thèmes. Aucun nouveau token de couleur.

FORM: en-tête plein bord sur téléphone ; colonne mesurée pour le titre Anton (`min(58, (heroWidth - 52) / 6.1)`, compact 38), mot-symbole Jakarta, contrôles arrondis à 11px, champs transparents à contour. Le cadre natif fixe utilise `KeyboardAvoidingView` et `View`, sans ScrollView. Il mesure cadre et formulaire ; l’image prend la hauteur restante, et un petit bandeau de marque remplace le hero quand l’espace manque. À partir de 768px, composition en deux colonnes bornée à 1040px. Le clavier masque hero et accessoires secondaires, en conservant les formulaires montés. La saisie reste ancrée juste au-dessus du clavier ; toucher hors du champ ferme le clavier. La touche Terminé du code d’invitation libère explicitement le focus sans effacer le code. Cette adaptation au manque de hauteur n’est pas une promesse de pixel-match sur petit écran ou en grande taille de texte.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

STORY: le fondateur nomme le foyer et obtient un code à partager ; le rejoignant arrive par lien ou QR, avec le code conservé pendant l’authentification.

FIRST VIEWPORT: en-tête Garden compact avec accueil personnel, choix créer/rejoindre à contour et sélection `blobStrong`/`ink`, puis une seule branche visible sur le fond `cream`. Création : introduction simple et nom du foyer. Jonction : huit cases de code, collage et scan QR. Les branches conservent les saisies ; la branche cachée quitte l’arbre d’accessibilité. Contenu borné à 480px. Le clavier masque l’introduction, la visite facultative et changer de compte ; le champ actif et son action restent disponibles. Le cadre sans ScrollView adapte la place du hero à la hauteur disponible.

## Comportements conservés

Une invitation en attente, un lien ou un scan sélectionne rejoindre. La validation, les erreurs de code, le collage depuis un message partagé et le scan sont conservés. Requêtes en cours : contrôles désactivés et état d’attente visible. La préférence de visite est enregistrée avant publication du foyer dans le cache ; « Me faire visiter l’app » démarre désactivé et reste passable. « Changer de compte » est disponible hors clavier et hors requête. Les courses de création/jonction déjà résolues déclenchent une relecture du foyer.

## Réalisation et revue

Disposition indépendante : **RECAPTURE**, pas de verdict ship. Les deux tentatives de capture native ont été bloquées par les permissions de contrôle de l’ordinateur. La revue des sources a identifié une taille de titre calculée depuis le viewport tablette ; elle est maintenant calculée depuis la colonne mesurée par `onLayout`. La fidélité visuelle au comp, le clavier, les petits écrans, les grandes tailles de texte et le rendu sombre/tablette restent à vérifier sur captures natives. Les aperçus de composants et l’inspection statique ne les valident pas. Aucun test, build, lint ou typecheck exécuté conformément à AGENTS.md.

Asset : `assets/illustrations/garden-harvest.png`, nature morte photographique générée de carottes et poire sur fond transparent ; prompt conservé dans `.impeccable/mocks/decision/garden-harvest.prompt.txt` et dans les métadonnées du PNG. La petite carotte 3D de l’ancienne adaptation n’est plus le visuel du hero. Anton est embarquée dans `assets/fonts/Anton-Regular.ttf` ; le mot-symbole charge localement le fichier Plus Jakarta Sans 800 existant. Les polices ordinaires de l’application restent inchangées.

## Adaptation aux faibles hauteurs

Le cadre transmet sa hauteur mesurée aux formulaires. Inscription : un champ à la fois sous `(clavier ? 470 : 740) × fontScale` ; connexion : sous `(clavier ? 410 : 560) × fontScale`. Une hauteur encore inconnue (0) ou suffisante conserve le formulaire complet. Les champs restent montés avec leurs valeurs, refs et mutations ; les champs inactifs sont masqués. « Continuer » avance jusqu’au mot de passe, puis l’action habituelle soumet. Un retour de 44px minimum permet de revenir ; le focus suit l’étape après rendu lorsque le clavier est ouvert. L’indicateur de force se masque au clavier, mais l’aide de longueur du mot de passe reste présente à cette étape. Deux tests ciblés couvrent étapes compactes, brouillons et soumission ; ils n’ont pas été exécutés.

Au seuil foyer, le clavier masque aussi le sélecteur créer/rejoindre, les explications, collage/scan, visite et changement de compte ; le champ actif et son action restent visibles. Le hero invalide ses mesures sur changement de largeur, taille du texte, mode compact, titre, sous-titre ou chargement des polices, afin de recalculer le repli en bandeau. Ces adaptations nécessaires au cadre sans défilement ne constituent pas un pixel-match garanti sur petits écrans ; la disposition reste **RECAPTURE**.

### Fond partagé — dernière consigne utilisateur

L’aplat vert est remplacé par le `AuthBlobBackground` mouvant existant sur fond `cream`, avec les gradients `blobStrong`/`blobSoft`. Une seule instance vit dans `AuthBackgroundFrame`, au-dessus du navigateur racine. Les pages auth/onboarding et leurs écrans de chargement restent transparents : navigation et clavier ne recréent pas ce fond. La position animée est conservée ; la dérive se met en pause hors du parcours et en arrière-plan, avec respect de Réduire les animations. Typographie, photographie et disposition sont conservées. Test de conservation du montage ajouté, non exécuté selon AGENTS.md ; transitions natives à recapturer pour confirmer visuellement l’absence de flash. Cette consigne remplace les mentions antérieures de l’aplat organique.

### Animate — choix et continuité

`AuthStep` anime seulement la branche qui devient active après un changement de choix : translation latérale de 32pt à pleine opacité, 280ms iOS/web ou 300ms Material Android. Les formulaires restent montés ; pas d’entrée rejouée au premier rendu ou à l’ouverture du clavier. Réduire les animations remplace le mouvement par un fondu de 100ms. Les boutons Garden se compriment à 0.94 et la flèche primaire avance de 6pt pendant la pression sur iOS/web et reste fixe sous réduction du mouvement ; le ripple Android est conservé. Le blob partagé conserve sa position entre les pages avec une dérive plus perceptible : -20 à 100pt horizontalement et ±12pt verticalement, 7s par trajet ; débordement du calque ajusté aux mêmes bornes. Navigation native inchangée. Aucune entrée en fondu depuis le bas. Source inspectée, test de conservation des saisies ajouté sans exécution ; fluidité et captures natives restent à vérifier, aucun simulateur démarré.

### Delight — arrivée dans le foyer

Thèse : se sentir accueilli chez soi après une vraie réussite. Création/jonction confirmée par le serveur : toast racine « Bienvenue dans {nom du foyer}. », notification tactile de succès et annonce accessible native, sans retarder la navigation. Aucun accueil sur erreur ou récupération `already_in_household`. Collage d’un code reconnu : confirmation `Code collé` dans le HintBubble existant, puis invitation à rejoindre ; aucune promesse de validité ou d’accès avant réponse serveur. Layout et animations inchangés. Tests ciblés ajoutés/étendus, non exécutés selon AGENTS.md ; rendu et sensations sur appareil restent à vérifier.

Dernière autorité utilisateur : réintégrer `assets/mascot.png` dans le splash et le header d’auth à la place de la photographie. Typographie Garden, fond partagé et comportement clavier restent inchangés. Mascotte en boîte carrée contenue, 200pt maximum au grand header et 112pt compact, réduite à la place disponible. Le splash remplace ses trois points par PantryLoader, une feuille sur rail sans pourcentage fictif. La photographie et sa maquette restent des références historiques ; elles ne sont plus le visuel des headers actifs.
