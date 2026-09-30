# Authentification et onboarding — brief de redesign

Statut : direction Garden et parcours UX validés ; adaptation initiale rejetée car non reconnaissable. Correction de composition implémentée, puis dernière consigne appliquée : couleurs du DESIGN.md uniquement, fournisseurs sur une rangée, sans ScrollView. Disposition actuelle : **RECAPTURE** ; fidélité native non validée.

## Objectif et public

Refondre complètement le visuel et l’UX de l’entrée dans Garde-manger mobile pour rendre la création de compte plus simple et rassurante. Public : personnes qui démarrent un foyer, rejoignent un foyer invité ou retrouvent leur compte. Mode de la surface : Operate.

La réussite se lit dans le parcours : comprendre ce que le compte permet, choisir une méthode disponible sans ambiguïté, créer ou rejoindre son foyer, puis accéder à l’application. Aucun objectif chiffré de conversion n’est inventé.

## Direction choisie : Le jardin commun

Choix confirmé dans le comparatif : `gardens`, réalisation guidée par maquette (`comp`). Référence choisie : `gardens.png`, conservée sans régénération. Références de qualité : `gardens-reference.webp` et `gardens-hero-reference.webp`.

Un grand aplat vert pomme à contour organique occupe l’accueil ; fond crème, encre sombre, action jaune et typographie grotesque expressive. Les aliments détourés donnent au produit un sujet concret. Le premier écran porte « Votre foyer. Votre garde-manger. » puis une zone calme consacrée à la création de compte. Les formulaires héritent de cet univers avec une présence graphique réduite, afin que champs et clavier aient la priorité.

**Autorité actuelle :** conserver la composition de `gardens.png`, la grande typographie Anton, le mot-symbole Jakarta et la photographie de carottes/poire ; adapter uniquement les couleurs aux tokens existants : `cream` pour le fond, `blobStrong` pour l’aplat, `ink` pour le texte, `accentLime`/`accentLimeText` pour l’action. Les thèmes sombre et clair suivent `soft-palette`. Aucun nouveau hex de couleur n’est introduit.

La consigne initiale « adapte quand même au design.md présent dans /mobile » ne justifie plus de réduire Garden à une petite carotte 3D sur menthe pâle. Cette interprétation et l’ancien verdict statique ship sont supersédés. La dernière demande conserve le design/layout, regroupe les fournisseurs horizontalement et supprime les ScrollViews auth/onboarding. Les formulaires natifs et le système visuel autour restent préservés.

## Parcours proposé

1. Réunir la présentation et le choix d’inscription dans un accueil utile, avec « Se connecter » directement accessible. Supprimer le carrousel préalable obligatoire. Une personne qui revient sur son appareil arrive à la connexion ; une session valide poursuit les redirections existantes.
2. Utiliser le serveur officiel au premier démarrage lorsqu’aucun serveur n’est déjà configuré et qu’aucun `EXPO_PUBLIC_API_URL` ne le remplace au build. Afficher le serveur actif et « Modifier » avant l’authentification. Respecter une configuration existante. L’auto-hébergement devient un sous-parcours accessible avec adresse, vérification et retour à l’action initiale.
3. N’afficher que les méthodes réellement activées et compatibles avec la plateforme. Les maquettes Apple / Google / e-mail sont un exemple, pas une liste imposée. Conserver PocketID et les clés d’accès dans les contextes actuellement pris en charge. Une instance à mot de passe seul affiche directement le formulaire sous le grand hero tant que la hauteur disponible le permet. Les fournisseurs sont réunis dans une rangée de boutons avec logo, nom court et libellé accessible complet ; l’e-mail reste une action séparée.
4. Pour l’e-mail, un formulaire unique avec nom, e-mail et mot de passe, règles existantes explicites, affichage du mot de passe, autofill et progression clavier. Inscription et connexion ont des titres et actions sans ambiguïté ; le geste horizontal n’est plus nécessaire pour changer de mode.
5. Après authentification, présenter un choix clair : créer un foyer ou en rejoindre un. Un lien d’invitation conserve son code pendant l’authentification et ouvre directement le parcours de jonction. Préserver collage, scan QR et validation du code à huit caractères ; ne pas promettre le nom du foyer avant que les données le permettent.
6. Entrer dans le vrai garde-manger. La visite guidée est facultative et le premier scan reste facultatif. Les personnes possédant déjà un foyer ne refont pas sa création.

## Interactions et états

Une action principale lisible par contexte. Retour natif disponible, focus prévisible, saisie conservée en cas d’erreur ou d’aller-retour compatible avec le serveur actif. Les erreurs identifient l’action possible : corriger un champ, réessayer, choisir une autre méthode ou modifier le serveur. Prévoir chargement des méthodes, absence de méthode, serveur indisponible, vérification en cours, incompatibilité de version signalée, requête d’inscription en cours, erreur de compte, annulation d’un fournisseur et invitation invalide.

La transition signature réduit la zone verte illustrée lorsqu’on entre dans la saisie, tout en conservant des repères stables. Elle ne retarde ni le focus ni la frappe. Avec réduction des animations, utiliser une transition immédiate ou un fondu discret. Préserver les gestes de retour iOS et Android.

## Périmètre et contraintes

Cibles : welcome, server-choice, sign-in/sign-up, création/jonction du foyer, saisie et scan du code d’invitation, entrée de la visite guidée. Repenser compositions, hiérarchie, textes d’interface, navigation, feedback et transitions. Ne pas modifier le dashboard, les autres écrans métier ou leurs tokens globaux au titre de cette refonte.

Conserver les contrats backend, les méthodes d’authentification découvertes dynamiquement, les redirections de session et les liens existants. Aucun nouveau mode d’authentification, questionnaire de préférences ou mécanisme de récupération de compte n’est promis par ce brief.

Expo / React Native / Tamagui existants ; iOS et Android, téléphones et tablettes. Prévoir clavier ouvert, petits écrans, noms et adresses longs, grande taille de texte, mode sombre et lecteurs d’écran. Les formulaires restent d’une largeur lisible sur tablette, sans étirer un écran de téléphone. Les couleurs d’erreur ou de succès ne portent jamais seules l’information.

## Réalisation et validation

Le parcours conserve brouillons, méthodes dynamiques, détour serveur, invitations, gates de session/foyer, création/jonction et visite opt-in. Apple conserve sa connexion native avec le logo officiel existant dans le bouton compact. Les actions de méthode, mode et serveur restent bloquées pendant une authentification.

Le cadre partagé est fixe, avec safe areas et `KeyboardAvoidingView`, sans ScrollView. Il mesure le cadre et le contenu pour adapter la photographie à l’espace restant ; un bandeau de marque remplace le hero si la hauteur manque. Le titre utilise la largeur mesurée de sa colonne. Le clavier masque hero et accessoires secondaires et resserre les espacements login/signup ; les formulaires restent montés. Les adaptations aux petits écrans et aux grandes tailles de texte demandent encore une vérification native.

## Réalisation et revue

Disposition indépendante : **RECAPTURE**, pas de verdict ship. Les deux tentatives de capture native ont été bloquées par les permissions de contrôle de l’ordinateur. La revue des sources a identifié une taille de titre calculée depuis le viewport tablette ; elle est maintenant calculée depuis la colonne mesurée par `onLayout`. La fidélité visuelle au comp, le clavier, les petits écrans, les grandes tailles de texte et le rendu sombre/tablette restent à vérifier sur captures natives. Les aperçus de composants et l’inspection statique ne les valident pas. Aucun test, build, lint ou typecheck exécuté conformément à AGENTS.md.

Asset : `assets/illustrations/garden-harvest.png`, nature morte photographique générée de carottes et poire sur fond transparent ; prompt conservé dans `.impeccable/mocks/decision/garden-harvest.prompt.txt` et dans les métadonnées du PNG. La petite carotte 3D de l’ancienne adaptation n’est plus le visuel du hero. Anton est embarquée dans `assets/fonts/Anton-Regular.ttf` ; le mot-symbole charge localement le fichier Plus Jakarta Sans 800 existant. Les polices ordinaires de l’application restent inchangées.

## Adaptation aux faibles hauteurs

Le cadre transmet sa hauteur mesurée aux formulaires. Inscription : un champ à la fois sous `(clavier ? 470 : 740) × fontScale` ; connexion : sous `(clavier ? 410 : 560) × fontScale`. Une hauteur encore inconnue (0) ou suffisante conserve le formulaire complet. Les champs restent montés avec leurs valeurs, refs et mutations ; les champs inactifs sont masqués. « Continuer » avance jusqu’au mot de passe, puis l’action habituelle soumet. Un retour de 44px minimum permet de revenir ; le focus suit l’étape après rendu lorsque le clavier est ouvert. L’indicateur de force se masque au clavier, mais l’aide de longueur du mot de passe reste présente à cette étape. Deux tests ciblés couvrent étapes compactes, brouillons et soumission ; ils n’ont pas été exécutés.

Au seuil foyer, le clavier masque aussi le sélecteur créer/rejoindre, les explications, collage/scan, visite et changement de compte ; le champ actif et son action restent visibles. Le hero invalide ses mesures sur changement de largeur, taille du texte, mode compact, titre, sous-titre ou chargement des polices, afin de recalculer le repli en bandeau. Ces adaptations nécessaires au cadre sans défilement ne constituent pas un pixel-match garanti sur petits écrans ; la disposition reste **RECAPTURE**.

### Fond partagé — dernière consigne utilisateur

L’aplat vert est remplacé par le `AuthBlobBackground` mouvant existant sur fond `cream`, avec les gradients `blobStrong`/`blobSoft`. Une seule instance vit dans `AuthBackgroundFrame`, au-dessus du navigateur racine. Les pages auth/onboarding et leurs écrans de chargement restent transparents : navigation et clavier ne recréent pas ce fond. La position animée est conservée ; la dérive se met en pause hors du parcours et en arrière-plan, avec respect de Réduire les animations. Typographie, photographie et disposition sont conservées. Test de conservation du montage ajouté, non exécuté selon AGENTS.md ; transitions natives à recapturer pour confirmer visuellement l’absence de flash. Cette consigne remplace les mentions antérieures de l’aplat organique.
