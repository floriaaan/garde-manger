# Authentification et onboarding — brief de redesign

Statut : direction visuelle Garden et brief UX validés, puis implémentation autorisée avec adaptation au `mobile/DESIGN.md` existant. Implémentation et revue statique terminées ; verdict ship au périmètre statique. Aucune validation native à l’exécution.

## Objectif et public

Refondre complètement le visuel et l’UX de l’entrée dans Garde-manger mobile pour rendre la création de compte plus simple et rassurante. Public : personnes qui démarrent un foyer, rejoignent un foyer invité ou retrouvent leur compte. Mode de la surface : Operate.

La réussite se lit dans le parcours : comprendre ce que le compte permet, choisir une méthode disponible sans ambiguïté, créer ou rejoindre son foyer, puis accéder à l’application. Aucun objectif chiffré de conversion n’est inventé.

## Direction choisie : Le jardin commun

Choix confirmé dans le comparatif : `gardens`, réalisation guidée par maquette (`comp`). Référence choisie : `gardens.png`, conservée sans régénération. Références de qualité : `gardens-reference.webp` et `gardens-hero-reference.webp`.

Un grand aplat vert pomme à contour organique occupe l’accueil ; fond crème, encre sombre, action jaune et typographie grotesque expressive. Les aliments détourés donnent au produit un sujet concret. Le premier écran porte « Votre foyer. Votre garde-manger. » puis une zone calme consacrée à la création de compte. Les formulaires héritent de cet univers avec une présence graphique réduite, afin que champs et clavier aient la priorité.

Palette de direction : crème #F5F1E4, vert #8ED462, encre #2C2E2A, jaune #F5E211. Les aplats de la réalisation seront uniformes : le léger modelé présent dans la maquette générée n’est pas une intention de design. Les contrôles gardent les comportements natifs et les exigences des fournisseurs d’authentification.

**Adaptation d’implémentation confirmée :** cette palette et cette typographie décrivent la maquette choisie, pas de nouveaux tokens globaux. La consigne ultérieure « adapte quand même au design.md présent dans /mobile » gouverne la réalisation : lobe menthe `blobSoft`, crème, encre et lime existants, typographie système mobile, boutons pilules et angles asymétriques. La carotte `assets/illustrations/carrot-3d.png` pré-existante est conservée sans modification ; aucun nouvel asset raster. La composition Garden reste la référence, sans exigence de reproduction pixel à pixel.

## Parcours proposé

1. Réunir la présentation et le choix d’inscription dans un accueil utile, avec « Se connecter » directement accessible. Supprimer le carrousel préalable obligatoire. Une personne qui revient sur son appareil arrive à la connexion ; une session valide poursuit les redirections existantes.
2. Utiliser le serveur officiel au premier démarrage lorsqu’aucun serveur n’est déjà configuré et qu’aucun `EXPO_PUBLIC_API_URL` ne le remplace au build. Afficher le serveur actif et « Modifier » avant l’authentification. Respecter une configuration existante. L’auto-hébergement devient un sous-parcours accessible avec adresse, vérification et retour à l’action initiale.
3. N’afficher que les méthodes réellement activées et compatibles avec la plateforme. Les maquettes Apple / Google / e-mail sont un exemple, pas une liste imposée. Conserver PocketID et les clés d’accès dans les contextes actuellement pris en charge. Une instance ne proposant que le mot de passe peut afficher directement le formulaire.
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

Le parcours implémenté réunit accueil et méthodes, remplace le pager par des choix nommés, ouvre directement l’e-mail sur les instances à mot de passe seul, conserve le détour serveur et ses vérifications, puis présente une branche créer/rejoindre à la fois. Une invitation sélectionne rejoindre ; la visite est opt-in et le premier scan facultatif. Le cadre partagé respecte les safe areas natives, borne les formulaires sur tablette et retire immédiatement l’illustration pendant la saisie ou lorsque le clavier s’ouvre.

Revue statique terminée : les corrections préservent les brouillons lors d’une sauvegarde du même serveur, enregistrent la préférence de visite avant la publication du foyer et bloquent les changements de méthode, mode ou serveur pendant l’authentification. Sources et tests écrits/modifiés inspectés. Aucun test, build, lint, typecheck, détecteur ou capture native exécuté, conformément à AGENTS.md. L’exécution iOS/Android, le clavier, les grandes tailles de texte et le rendu sombre/tablette restent non vérifiés. Aucun résultat statique ne constitue une preuve visuelle native.
