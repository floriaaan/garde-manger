---
version: 1
slug: "src-presentation-identity-auth-shell-tsx"
primary_target: "src/presentation/identity/auth-shell.tsx"
related_targets: ["src/presentation/identity/auth-entry-screen.tsx", "src/presentation/identity/auth-screen-chrome.tsx", "src/presentation/onboarding/threshold-screen.tsx", "src/app/welcome.tsx"]
---

Scope : authentification, accueil, serveur et onboarding du foyer. Mode : Operate.
Brief UX validé : inscription courte, serveur modifiable, méthodes dynamiques, invitations préservées et découverte facultative.

## Direction contract

THESIS: Garden fait entrer dans un espace partagé ; l’accueil et les méthodes de création se trouvent sur un même écran, sans carrousel ni panneau photo.

OWN-WORLD: adaptation explicite demandée par l’utilisateur : « adapte quand même au design.md présent dans /mobile ». La maquette gardens guide la composition ; les tokens et composants existants gouvernent la réalisation : menthe organique, crème, lime pour agir, encre, angles asymétriques, boutons pilules, typographie système mobile. Aucun nouveau thème global.

STORY: choisir son accès, saisir seulement le nécessaire, créer ou rejoindre son foyer, entrer. Serveur actif visible ; aucune promesse de confidentialité inventée.

FIRST VIEWPORT: marque en haut, grand lobe menthe avec titre et carotte 3D existante, méthodes nommées lisibles dessous sur une surface calme. Une instance limitée au mot de passe ouvre directement le formulaire. Sur tablette, le jardin se place à côté du formulaire de largeur bornée. Le choix e-mail retire le jardin, et toute ouverture du clavier masque le hero encore présent ; aucun champ ne dépend d’une animation de hauteur. Le cadre partagé gère safe areas natives, clavier et défilement naturel. Largeur du formulaire auth : 440 px ; seuil foyer : 480 px ; composition latérale avec jardin dès 768 px.

FORM: challenger Garden choisi, seed 01e57bcf. La consigne d’adaptation remplace la reproduction pixel à pixel du comp ; garder les assets de marque existants et la grammaire du DESIGN.md. Maquette de référence : .impeccable/mocks/decision/gardens.png.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Réalisation et revue

Implémenté : accueil et méthodes réunis, bascule connexion/inscription par actions explicites, formulaire e-mail sans pager, serveur actif modifiable, choix créer/rejoindre et visite facultative désactivée par défaut. URL conservée si enregistrée ; sinon `EXPO_PUBLIC_API_URL` prime sur le serveur officiel par défaut. Le détour serveur revient à l’intention initiale et sauvegarder le même serveur conserve les brouillons. Une invitation en attente sélectionne directement rejoindre. Les actions de méthode, mode et serveur sont bloquées pendant l’authentification ; la préférence de visite est enregistrée avant de publier le foyer dans le cache.

Asset raster : `assets/illustrations/carrot-3d.png`, pré-existant au dépôt, réutilisé sans modification ni génération. La maquette `gardens.png` reste une référence de composition ; sa palette et sa typographie ne remplacent pas `DESIGN.md`.

Verdict : ship au périmètre de revue **statique**, revue terminée. Sources et tests écrits/modifiés inspectés ; aucun test, build, lint, typecheck ou détecteur exécuté conformément à AGENTS.md. Aucune vérification d’exécution ou capture native : rendu iOS/Android, clavier, grande taille de texte et comportement visuel sombre/tablette restent non vérifiés à l’exécution.
