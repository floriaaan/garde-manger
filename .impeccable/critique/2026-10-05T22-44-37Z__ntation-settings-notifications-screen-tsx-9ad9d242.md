---
target: Parcours Notifications après alignement des switches et masquage des réglages désactivés
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/notifications-screen.tsx"
target_fingerprint: "sha256:191d6259260960fc9f27bc689d0d7044f91f662703b08a5aff51a4a57a1d1572"
target_path: /Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/notifications-screen.tsx
timestamp: 2026-10-05T22-44-37Z
slug: ntation-settings-notifications-screen-tsx-9ad9d242
---
Méthode : deux évaluations indépendantes (A : /root/critique_notifications_design · B : /root/critique_notifications_evidence).

Critique du parcours Notifications, basée sur le code. Aucun aperçu natif ni capture récente de ces écrans n’était disponible ; l’alignement réel, le texte agrandi et le comportement VoiceOver/TalkBack restent à observer sur appareil.

L’interface correspond bien à Garde-manger : elle distingue la réception sur cet appareil des rappels partagés avec le foyer. Les réglages masqués à la désactivation allègent les sous-pages. La principale faiblesse restante concerne la confiance dans les statuts affichés.

| Heuristique | Note /4 | Observation |
|---|---:|---|
| Visibilité du statut | 2 | Retour d’enregistrement présent, mais éloigné ; arrêt parfois annoncé à tort. |
| Correspondance avec le quotidien | 3 | Délais et jours clairs ; quelques termes techniques. |
| Contrôle utilisateur | 3 | Activations indépendantes, retour et reprise. |
| Cohérence | 3 | Composants partagés ; zone tactile différente selon le switch. |
| Prévention des erreurs | 2 | Édition verrouillée pendant l’enregistrement ; échec de désactivation ignoré. |
| Reconnaissance | 3 | État et choix conservés visibles dans la page principale. |
| Efficacité | 3 | Enregistrement automatique ; listes longues. |
| Simplicité | 3 | Affichage conditionnel pertinent ; sept cartes pour un jour. |
| Récupération des erreurs | 2 | Certains échecs d’activation n’offrent pas de bouton de reprise. |
| Aide contextuelle | 3 | Portée et cadence expliquées ; incompatibilité trop vague. |
| **Total** | **27/40** | **Acceptable : base solide, fiabilité à améliorer.** |

Points réussis : les titres des rappels dominent leurs cartes ; la portée appareil/foyer est explicite ; les choix de délai et de jour disparaissent lorsque leur rappel est coupé, avec conservation des valeurs. Les sauvegardes disposent de messages de progression, de succès et de reprise.

Priorités :

1. **P1 — Le switch général peut annoncer un arrêt qui a échoué.** `push-notifications.ts:158` ignore le résultat d’une désinscription native échouée, puis `notifications-row.tsx:59` affiche le switch désactivé. Le serveur peut encore conserver le jeton. **Correction :** vérifier le résultat, conserver l’état confirmé et proposer Réessayer. Commande : `$impeccable harden`.
2. **P1 — Un problème temporaire ressemble à une incompatibilité.** Les échecs de récupération ou d’enregistrement du jeton deviennent `unavailable` dans `push-notifications.ts:90–138`. `notifications-row.tsx:74` affiche une indisponibilité de l’appareil sans reprise explicite pour ce cas. **Correction :** distinguer environnement incompatible et erreur temporaire ; proposer Réessayer pour cette dernière. Commande : `$impeccable harden`.
3. **P2 — La confirmation est trop éloignée du réglage modifié.** `pantry-checkup-screen.tsx:57` place le retour après les sept cartes ; `expiry-reminder-screen.tsx:64` fait de même. Sur petit écran ou texte agrandi, risque de confirmation et de reprise hors champ, sans preuve visuelle disponible. **Correction :** rapprocher le retour de l’activation ou du titre du réglage ; alléger la liste hebdomadaire. Commande : `$impeccable layout`.
4. **P2 — Un avertissement peut rester après correction des permissions.** `notifications-row.tsx:48` charge les détails à l’ouverture, tandis que le statut est rafraîchi au retour au premier plan. Le code permet donc un statut actif accompagné d’un ancien avertissement de blocage. **Correction :** actualiser les détails des permissions au retour et réconcilier le message avec le statut courant. Commande : `$impeccable harden`.

Charge cognitive modérée : cinq délais et sept jours visibles enfreignent deux critères du guide, mais les jours forment une série familière ; ce constat ne justifie pas à lui seul de les cacher dans un menu. Le parcours commence par des états explicites et se termine moins bien lorsque le retour de sauvegarde est éloigné ou que l’erreur semble définitive.

Personas : Jordan peut prendre une panne réseau pour une incompatibilité. Casey doit parcourir une longue liste pour retrouver la confirmation. Sam bénéficie de libellés et d’annonces, mais les groupes radio n’ont pas de nom explicite et leur état utilise `selected` sans `checked` ; annonces natives à vérifier.

Détails secondaires : présenter les jours du lundi au dimanche tout en conservant les indices ; remplacer « Quand veux-tu être prévenu ? » par une formulation adressée au foyer ; préciser qu’un planning affiché sur une carte désactivée est conservé. Harmoniser la zone tactile entre la ligne générale et les activations individuelles.

Questions de conception : la confirmation pourrait-elle rester près de chaque action ? Une liste hebdomadaire plus compacte préserverait-elle mieux la simplicité et l’accessibilité ?

Détecteur : scan du dossier `mobile/src/presentation/settings`, sortie `[]`, code 0, aucun signalement ni faux positif. Ce résultat ne valide pas les états réseau ou le rendu natif.
