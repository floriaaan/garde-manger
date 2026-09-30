---
version: 1
slug: "src-presentation-onboarding-threshold-screen-tsx"
primary_target: "src/presentation/onboarding/threshold-screen.tsx"
related_targets: ["src/presentation/onboarding/invite-code-field.tsx","src/presentation/onboarding/first-run-tour.tsx"]
---

Scope: le groupe `(onboarding)` — le seuil créer/rejoindre, le scan QR du code, et les quatre temps posés sur le dashboard réel. Mode visiteur : Operate.

Audience : deux populations. Le fondateur, seul dans sa cuisine, qui nomme le foyer et repart avec un code. Le rejoignant, qui arrive avec un code déjà en main — souvent depuis un lien `gardemanger://join?code=…` ou un QR.

Contraintes : les mutations mobiles de création/jonction utilisent les contrats backend existants (`POST /api/households`, `POST /api/households/join`, code `^[A-Z0-9]{8}$`). Les gates de session et de foyer existants restent en place ; ce redesign ne change pas les contrats backend.

Hors périmètre : aucune amorce de remplissage. Le dernier temps du tour peut offrir le scanner ; il ne l'impose pas.

Non résolu : pas d'universal link — l'instance est auto-hébergée, il n'existe aucun domaine à revendiquer, donc le partage repose sur le schéma `gardemanger://` plus le code en clair.

## Direction contract

THESIS: l'onboarding est un seuil franchi, pas un couloir traversé. Une décision plein écran — créer un foyer ou en rejoindre un — puis le vrai dashboard qui se présente lui-même. Refuse le stepper à cinq écrans et le carrousel de slides.

OWN-WORLD: Garden adapté au Sunlit Pantry existant sur demande explicite de l’utilisateur — fond clair, menthe organique, crème, lime réservée à l’action, angles asymétriques et composants livrés. Le seuil partage le cadre natif `AuthScreenChrome` avec l’authentification ; pas de panneau mocha dans cette composition. Aucun token nouveau.

STORY: le fondateur nomme le foyer et repart avec un code à partager ; le rejoignant arrive par lien ou QR, code déjà posé dans les cases, et atterrit dans le même garde-manger.

FIRST VIEWPORT: marque en haut, accueil personnel, puis sélecteur explicite créer/rejoindre sur crème. Une seule branche est visible : création avec introduction menthe asymétrique et nom du foyer, ou jonction avec les huit cases de code, collage et scan QR. Un code reçu par lien ou scan active rejoindre. Les deux branches gardent leurs saisies ; la branche cachée quitte l’arbre d’accessibilité. Le cadre respecte les safe areas, le clavier et une largeur de contenu bornée. « Me faire visiter l’app » est désactivé par défaut ; la visite choisie montre un temps à la fois et reste passable. « Changer de compte » reste disponible hors requête en cours.

FORM: adaptation du seuil antérieur « Le seuil, puis la maison » (candidat 6, clé be93e49c) à Garden, choisi pour le parcours d’entrée complet (seed 01e57bcf). La consigne d’adaptation à `DESIGN.md` remplace le pixel-match de la maquette. Contrat courant : `src-presentation-identity-auth-shell-tsx.md`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.


Réalisation et revue : mise à jour implémentée ; verdict ship au périmètre statique. La préférence de visite est enregistrée avant la publication du foyer dans le cache. Sources et tests inspectés, tests écrits/modifiés mais non exécutés. Aucun test, build, lint, typecheck, détecteur ou capture native lancé ; rendu natif, clavier, grande taille de texte et adaptations visuelles ne sont pas vérifiés à l’exécution. Aucun nouvel asset raster sur ce seuil.
