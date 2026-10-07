---
target: "carte d’avis de la PR #89"
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-49ad75dc/mobile/src/presentation/dashboard/store-review-card.tsx"
target_fingerprint: "sha256:0bb8a94ced59bd77a2e2dd1d73cbcfd14fbf84b2ca6d9f20d3f13795096cb160"
target_path: /Users/floriaaan/.t3/worktrees/fridge-ai/t3code-49ad75dc/mobile/src/presentation/dashboard/store-review-card.tsx
timestamp: 2026-10-07T11-55-12Z
slug: sentation-dashboard-store-review-card-tsx-85eb3f2c
---
Method: dual-agent (A: /root/critique_design_a · B: /root/critique_evidence_b)

# Critique de la carte d’avis — PR #89

Cible : `mobile/src/presentation/dashboard/store-review-card.tsx`, dans son contexte dashboard. Évaluation du code et de la conception prévue ; aucun rendu actuel de la carte sur appareil. La capture du dashboard du 1er octobre précède son ajout du 7 octobre.

## Identité et impression générale

L’ajout appartient à Garde-manger : fond crème, texte secondaire teinté, bouton partagé et vocabulaire du foyer. Sa place après les tâches utiles respecte le caractère facultatif de la demande. Sa structure reste classique ; son principal manque concerne le retour après le toucher, davantage que son apparence.

Le détecteur retourne `[]` : zéro signalement, zéro règle, zéro emplacement. Il ne valide pas le rendu React Native, les composants importés ou les API des stores. Aucun overlay ni rendu navigateur : cette carte est volontairement masquée sur le web.

## Santé du design

Scores provisoires issus du code, sur 4.

| Heuristique | Note | Constat |
|---|---:|---|
| Visibilité de l’état | 1 | Désactivation sans libellé de progression ; une demande native peut ne rien afficher. |
| Langage du monde réel | 4 | Action et bénéfice compréhensibles. |
| Contrôle utilisateur | 3 | Sollicitation facultative, déclenchée au toucher. |
| Cohérence et standards | 3 | Composants partagés ; carte symétrique face aux formes documentées. |
| Prévention des erreurs | 4 | Verrou contre les touches concurrentes, repli en cas d’erreur. |
| Reconnaissance | 4 | Action nommée, aucune icône à deviner. |
| Efficacité | 3 | Un toucher, aucun formulaire supplémentaire. |
| Sobriété | 3 | Trois éléments, une action, emplacement secondaire. |
| Récupération après erreur | 2 | Message et nouvelle tentative possibles ; silence natif sans solution visible. |
| Aide contextuelle | 3 | Motif expliqué, limite du mécanisme natif absente. |
| **Total** | **30/40** | **Bon ; faiblesse concentrée sur le feedback.** |

## Points réussis

- Les décisions alimentaires restent prioritaires ; la carte arrive après les accès rapides.
- Le bouton réutilise les cibles tactiles et la sémantique existantes : 44 pt sur iOS, 48 dp sur Android.
- Aucun avis automatique ni demande de cinq étoiles. Fonctionnement indépendant du serveur et du plan ; erreurs conservées près de l’action.

## Priorités

1. **P2 — Une touche peut sembler sans effet.** `store-review-card.tsx:28` : l’OS peut supprimer la fenêtre sans exposer le résultat, puis le code revient au dashboard inchangé. Conserver le flux natif demandé par #88 ; ajouter une indication honnête après la tentative et une alternative explicite « Ouvrir la fiche du store ». Ne pas annoncer un avis envoyé ni ouvrir automatiquement une seconde destination. Commande : `$impeccable harden`.
2. **P2 — Progression peu compréhensible.** `store-review-card.tsx:54` : le texte reste « Laisser un avis » pendant que le bouton est désactivé. Employer « Ouverture des avis… » et exposer un état occupé ou une annonce adaptée. Cela explique que la touche a été reçue, notamment avec un lecteur d’écran. Commande : `$impeccable harden`.
3. **P3 — Forme moins caractéristique.** `store-review-card.tsx:49` : rayon uniforme de 18 alors que les surfaces principales documentées emploient des angles asymétriques. Reprendre une variation existante discrète si la carte doit appartenir à cette famille ; aucune refonte nécessaire. Commande : `$impeccable polish`.

Aucun P0/P1 établi. Le troisième point est une préférence de cohérence documentée, pas un obstacle utilisateur.

## Charge cognitive et parcours émotionnel

Charge faible : aucun échec établi parmi les huit critères. Un seul choix dans la carte, quatre destinations dans le groupe précédent ; aucune décision simultanée de plus de quatre options démontrée. La composition prévue groupe correctement motif et action. L’invitation est chaleureuse ; le creux émotionnel survient si l’utilisateur touche puis ne voit rien changer.

## Personas

- **Jordan, première utilisation** : comprend l’intention, mais peut prendre le silence pour une panne.
- **Sam, lecteur d’écran** : bouton correctement nommé ; « désactivé » n’explique pas la progression. Annonces réelles non vérifiées.
- **Casey, mobile et interruptions** : action courte et cible adaptée dans le code ; retour sans fenêtre peu explicite. Portée du pouce et dégagement de la navigation non vérifiés.

## Observations et limites

Français et anglais présents ; aucun texte technique inutile. La carte n’a pas de hauteur fixe, point favorable pour les textes agrandis, sans preuve de rendu. Les tests inspectés couvrent déclenchement, plateformes, repli, retry et touches répétées ; aucun test exécuté. Apparence sombre, Android, taille de police, VoiceOver/TalkBack et remise au store restent à observer sur appareil.

## Questions de conception

- Quand l’OS n’affiche rien, quel retour honnête rendrait le toucher utile : explication, lien du store, ou les deux ?
- Cette invitation doit-elle rester une action du dashboard ou devenir un remerciement encore plus discret ?

## Suivi des corrections

Les trois priorités ont été corrigées après cette évaluation : libellé de progression localisé, état accessible occupé et annonce iOS ; explication conditionnelle et alternative explicite vers le store après la tentative native ; angles asymétriques 26/14/26/14. La revue indépendante a jugé les trois corrections résolues dans le code. Les tests associés ont été ajoutés mais non exécutés. Le score ci-dessus décrit l’état antérieur ; aucun nouveau score ni validation du rendu natif n’est revendiqué.
