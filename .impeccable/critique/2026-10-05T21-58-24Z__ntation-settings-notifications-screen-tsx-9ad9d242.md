---
target: Notifications et sous-pages de rappels
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/notifications-screen.tsx"
target_fingerprint: "sha256:1601360eec9f6a5befac60e9ff0280f78a18bd8635fe241ea351b92129851661"
target_path: /Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/notifications-screen.tsx
timestamp: 2026-10-05T21-58-24Z
slug: ntation-settings-notifications-screen-tsx-9ad9d242
---
Method: dual-agent (A: /root/critique_design · B: /root/critique_evidence)

Critique de Notifications et de ses deux sous-pages, en mode Operate. Évaluation fondée sur le code : aucun navigateur disponible, donc aucun rendu, contraste ou comportement sur appareil vérifié.

**Verdict : une bonne structure, mais des états trop ambigus.** Les contenus sont propres à Garde-manger : péremption, entretien de l’inventaire, rythme hebdomadaire et réglages partagés. Les composants reprennent l’identité existante. En revanche, les cartes mettent « Actif » au premier plan et relèguent le nom du rappel, alors que ce nom devrait guider la navigation.

Le détecteur a renvoyé **0 constat** (`[]`, code de sortie 0) sur `mobile/src/presentation/settings`. Les deux évaluations ont néanmoins trouvé le même défaut d’accessibilité. Aucune surcouche visuelle n’a été injectée.

**Santé UX : 24/40 — acceptable, à améliorer avant livraison.**

| Heuristique | /4 | Constat principal |
|---|---:|---|
| Visibilité de l’état | 2 | Enregistrement silencieux ; activation du foyer distincte de la réception sur l’appareil. |
| Correspondance avec le monde réel | 3 | Actions concrètes de cuisine ; fuseau technique dans les explications. |
| Contrôle et liberté | 3 | Retour et réglages réversibles ; refus des permissions ouvre directement les réglages système. |
| Cohérence et standards | 2 | Composants partagés, mais noms accessibles incomplets et zones de bascule différentes. |
| Prévention des erreurs | 2 | Choix contraints ; état de réception absent des sous-pages. |
| Reconnaissance plutôt que mémorisation | 2 | Délai absent du résumé ; état général à retenir. |
| Souplesse et efficacité | 3 | Sauvegarde immédiate et configuration conservée quand désactivée. |
| Sobriété et hiérarchie | 3 | Structure ciblée ; statut plus visible que destination. |
| Récupération après erreur | 1 | Relance implicite et erreurs inattendues du switch général sans message. |
| Aide contextuelle | 3 | Portée et usage des rappels expliqués. |
| **Total** | **24/40** | **Acceptable** |

**Ce qui fonctionne**

- Une entrée Notifications rassemble les réglages ; l’interrupteur général arrive en premier.
- Le check-up décrit une tâche utile et ouvre l’inventaire pour agir.
- Les choix de délai et de jour ont des états sélectionnés accessibles, des lignes d’au moins 56 px et des valeurs par défaut.

**Les cinq priorités**

1. **P1 — Les deux liens sont indiscernables au lecteur d’écran.** Les cartes passent « Actif » comme valeur sans nom accessible explicite. [IdentityCard](/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/identity-card.tsx:153) utilise cette valeur comme libellé : le type de rappel disparaît. Ajouter un libellé comprenant le nom, l’état, le calendrier et l’action. Commande : `$impeccable harden`.

2. **P2 — « Actif » peut coexister avec les notifications coupées sur cet appareil.** [La page](/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/notifications-screen.tsx:31) affiche l’état du foyer ; le switch général pilote l’appareil. L’explication existe, mais les sous-pages demandent de retenir cette distinction. Employer « Activé pour le foyer » et afficher séparément la réception sur cet appareil. Garder la configuration du foyer possible même si cet appareil est désactivé. Commande : `$impeccable clarify`.

3. **P2 — L’enregistrement manque de retour explicite.** [Les choix](/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/pantry-checkup-screen.tsx:33) se désactivent pendant la requête ; seule la sélection finale confirme le résultat. Ajouter « Enregistrement… », puis un retour discret annoncé aux technologies d’assistance. Commande : `$impeccable harden`.

4. **P2 — La récupération demande de deviner l’action suivante.** [Le switch général](/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/notifications-row.tsx:34) n’intercepte pas les exceptions inattendues ; leur occurrence n’a pas été reproduite. Les erreurs de chargement proposent seulement « Tire pour réessayer ». Ajouter un message de bascule échouée et un bouton Réessayer visible. Commande : `$impeccable harden`.

5. **P2 — Le statut domine le nom du rappel.** [La carte](/Users/floriaaan/.t3/worktrees/fridge-ai/t3code-e90eb492/mobile/src/presentation/settings/identity-card.tsx:117) affiche le nom à 12 px et la valeur à 20 px en gras. Promouvoir le nom et rendre le statut secondaire ; résumer aussi le délai choisi, par exemple « 2 jours avant ». C’est un constat de hiérarchie dans le code, sans validation du rendu. Commande : `$impeccable layout`.

**Charge cognitive et parcours**

Trois critères échouent dans la grille stricte : regroupement des choix, nombre d’options et mémorisation de l’état général. Charge estimée modérée. Il y a cinq délais et sept jours ; sept jours restent un ensemble familier, donc ce nombre ne justifie pas à lui seul de cacher les choix. La liste des jours occupe au moins 392 px avant les espacements : un sélecteur plus compact mérite une vérification sur téléphone.

L’entrée rassure et le check-up donne un objectif concret. Le moment d’enregistrement est moins clair, et « Actif » peut laisser une confiance excessive dans la réception effective.

**Personas exposées**

- **Sam, lecteur d’écran** : entend deux destinations portant le même nom.
- **Casey, usage mobile interrompu** : peut quitter sans certitude sur la sauvegarde ou la réception.
- **Jordan, première utilisation** : doit réconcilier « Actif » avec le switch général éteint.

**Observations secondaires**

Les switches des sous-pages n’ont pas la même activation sur toute la ligne que le switch général. Les deux cartes répètent la même cloche. Le résumé est limité à une ligne : sa troncature à grande taille de texte reste à vérifier. La liste commence par dimanche alors que lundi est le défaut.

**Questions de conception**

Le résumé doit-il privilégier le type de rappel ou son état ? La distinction appareil/foyer peut-elle être comprise sans lire un paragraphe ?
