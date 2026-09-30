# Boot splash

MODE: Operate
TARGET: `src/presentation/shared/boot-splash.tsx`, native launch configuration in `app.json`.

USER AUTHORITY: `impeccable bolder` — refaire le splash à mi-chemin entre le nouvel auth Garden et `mobile/DESIGN.md`. Le périmètre est le splash, pas les pages voisines.

COMPOSITION: mascotte frigo existante au-dessus du grand nom Garde-manger en deux lignes Jakarta Sans 800, fond crème et blob partagé du mobile. Une feuille glisse sur un rail dans PantryLoader, accompagnée du texte système qui indique l’attente réelle ; aucun pourcentage fictif. La mascotte est réintégrée à la dernière demande utilisateur, sans rétablir le groupe d’icônes flottantes ; aucune nouvelle boucle ni entrée depuis le bas.

PALETTE: tokens `cream`, `ink`, `inkSecondary`, `blobStrong`/`blobSoft`, palette du loader : `blobSoft`, `ink`, `creamPillEdge`. Thèmes clair/sombre natifs.

RESPONSIVE: safe areas sur les quatre côtés ; composition centrée bornée à 440pt ; titre/photo réduits sous hauteur/fontScale 700 ; photographie supprimée sous 500. En attente bloquée sur écran compact, petit nom Jakarta et priorité aux actions de récupération. Jakarta garde un padding natif contre la coupe des glyphes.

BEHAVIOR: délai de 6s conservé ; nouvelle tentative et changement de serveur inchangés. Les portes de chargement inscrivent leur présence au cadre partagé : fond du navigateur natif transparent et blob actif même depuis `(tabs)` ; nettoyage à la sortie, sans recréer l’instance. Réduire les animations reste respecté. Aucun délai artificiel.

ASSET: `assets/mascot.png`, mascotte de l’application déjà présente, réutilisée sans génération. Polices déjà présentes. Aucun nouvel asset, couleur ou package. Splash natif configuré avec la même mascotte, largeur 220 et couleurs cream clair/sombre ; effectif à la prochaine compilation native.

VALIDATION: syntaxe TSX et diff vérifiés ; test ciblé de la porte de chargement ajouté sans exécution conformément à AGENTS.md. Captures et fluidité natives restent à vérifier ; les anciennes captures précèdent cette composition et ne prouvent pas sa fidélité.

LOADER: `PantryLoader`, cadre 108×32pt et trajet 80pt en 850ms par sens ; animation native arrêtée au blur, en arrière-plan et au démontage. Réduire les animations : feuille immobile au centre. Un seul progressbar accessible avec label de la tâche réelle ; décor masqué. Test d’accessibilité et réduction du mouvement ajouté, non exécuté selon AGENTS.md.

Dernière consigne : le nom du splash utilise aussi Jakarta Sans 800, déjà embarquée ; taille 52pt maximum (40pt compact), ligne 1.15 et padding 0.12em, sans gras synthétique.
