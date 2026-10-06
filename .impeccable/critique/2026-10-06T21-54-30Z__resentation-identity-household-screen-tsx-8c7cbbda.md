---
target: "écran du foyer et PR #67"
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-074ea908/mobile/src/presentation/identity/household-screen.tsx"
target_fingerprint: "sha256:e10d667167a2175f1c82ed9c7b91fa69fcc1180e99cedd2fb7c289c5e70c27a0"
target_path: /Users/floriaaan/.t3/worktrees/fridge-ai/t3code-074ea908/mobile/src/presentation/identity/household-screen.tsx
timestamp: 2026-10-06T21-54-30Z
slug: resentation-identity-household-screen-tsx-8c7cbbda
closed: true
---
Method: dual-agent (A: /root/design_assessment · B: /root/detector_assessment)

# Critique — écran du foyer
Cible : mobile/src/presentation/identity/household-screen.tsx. Mode Operate. Revue du code uniquement : aucun navigateur contrôlable ni capture correspondant à cet écran. Score provisoire, sans validation visuelle.

## Spécificité et impression
Le vocabulaire, les rôles, l’invitation et les conséquences sur le garde-manger ancrent le parcours dans Garde-manger. La composition utilise le système de réglages existant. La PR #67 empêche correctement le départ interdit d’un propriétaire. L’opportunité principale est de rendre le départ autorisé compréhensible et sûr.
Détecteur ciblé : 0 findings, exit 0, JSON []. Aucun faux positif. Aucun overlay visible.

## Santé UX
| # | Heuristique | Score /4 | Point principal |
|---|---|---:|---|
| 1 | État du système | 2 | Mutations sans attente visible |
| 2 | Langage métier | 3 | Conséquences concrètes ; propriété peu expliquée |
| 3 | Contrôle utilisateur | 2 | Transfert immédiat ; sortie propriétaire implicite |
| 4 | Cohérence | 3 | Composants partagés |
| 5 | Prévention des erreurs | 3 | Départ interdit masqué ; transfert sans confirmation |
| 6 | Reconnaissance | 3 | Rôles visibles ; séquence de départ implicite |
| 7 | Efficacité | 2 | Renommage toujours déplié |
| 8 | Sobriété | 3 | Sections ciblées ; rendu non vérifié |
| 9 | Récupération | 2 | Réessai initial ; erreurs de mutation dans un message bref |
| 10 | Aide contextuelle | 2 | Invitation expliquée ; départ propriétaire non expliqué |
| | Total | 25/40 | Acceptable |

## Points forts
- Protection du propriétaire dans le bouton, la confirmation et le gestionnaire.
- Identité du foyer, noms, rôles et attribution « toi » visibles.
- Retrait et départ expliquent les accès perdus et proposent Annuler.

## Priorités
1. P1 — Transfert immédiat au toucher d’un nom (household-screen.tsx:120 et :308). Une erreur de sélection change les droits du foyer. Ajouter une confirmation nommant le destinataire et les droits perdus. Commande : $impeccable harden.
2. P2 — Attente invisible (household-screen.tsx:92, :103, :120). Les feuilles se ferment avant la réponse sans afficher de progression ; les actions peuvent être rouvertes. Afficher le traitement, neutraliser les relances et conserver une récupération proche de l’action. Commande : $impeccable harden.
3. P2 — Départ propriétaire non expliqué (household-screen.tsx:248 et :260). Le propriétaire doit déduire qu’il peut transférer puis quitter. Garder l’action interdite masquée, expliquer la règle et le chemin autorisé quand un autre membre existe. Commande : $impeccable clarify.

## Charge cognitive et parcours émotionnel
Charge faible pour un membre. Pour un propriétaire, renommage permanent et gestion mêlée à l’invitation augmentent le nombre de tâches visibles. Aucun choix à plus de quatre options n’est démontré sur un foyer normal. L’invitation rassure ; la sortie propriétaire finit sans explication ; la fermeture immédiate du sélecteur rend l’attente incertaine.

## Personas
- Jordan, débutant : doit deviner transfert puis départ.
- Casey, mobile interrompu : aucune progression persistante après confirmation.
- Sam, lecteur d’écran : libellés présents mais état de mutation absent.

## Observations secondaires
Le formulaire de renommage pourrait être déplié à la demande. Le rafraîchissement ne recharge pas la requête Home Assistant et son chargement/échec est présenté comme « Non configuré ». PRODUCT.md conserve une description du départ destructif du propriétaire en décalage avec le connecteur réel. Densité, contraste, textes longs et agrandissement restent non vérifiés.

## Questions de direction
- Priorité : expliquer transfert puis départ, sécuriser transfert/attente, ou traiter les trois ?
- Périmètre : parcours départ/transfert uniquement, ou écran du foyer complet ?
