---
target: Écran de connexion et inscription
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/floriaaan/dev/fridge-ai/mobile/src/app/(auth)/sign-in.tsx"
target_fingerprint: "sha256:9dd9cb6de8b7ce5cea3a6e75952bce9c74828aace66e70eaa597f17c532acba7"
target_path: /Users/floriaaan/dev/fridge-ai/mobile/src/app/(auth)/sign-in.tsx
timestamp: 2026-09-27T20-33-09Z
slug: mobile-src-app-auth-sign-in-tsx
---
Method: dual-agent (A: /root/design_review · B: /root/detector_review)

# Critique Impeccable — connexion et inscription

**Cible :** mobile/src/app/(auth)/sign-in.tsx et ses composants. **Mode :** Operate. **Preuve :** code et contexte produit ; aucune capture de cet écran ni application lancée sur appareil.

## Santé du design

| # | Heuristique de Nielsen | /4 | Constat principal |
|---|---|---:|---|
| 1 | Visibilité de l’état | 3 | Soumissions signalées ; découverte initiale des méthodes silencieuse. |
| 2 | Langage de l’utilisateur | 3 | Vocabulaire simple et foyer présent ; PocketID et clé d’accès restent techniques. |
| 3 | Contrôle et liberté | 2 | Retour au choix possible ; aucun parcours d’oubli du mot de passe. |
| 4 | Cohérence | 2 | Le nombre de fournisseurs change la forme de leurs boutons et leur lisibilité. |
| 5 | Prévention des erreurs | 2 | Champs vides bloqués ; e-mail proposé même si le serveur l’interdit. |
| 6 | Reconnaissance | 2 | Actions principales nommées ; fournisseurs compacts à reconnaître par pictogramme. |
| 7 | Souplesse et efficacité | 3 | Plusieurs méthodes et saisie préservée ; détour par un choix e-mail même s’il est seul. |
| 8 | Esthétique et sobriété | 3 | Composition et palette cohérentes dans le code ; rendu réel non observé. |
| 9 | Récupération d’erreur | 2 | Erreurs annoncées ; correction peu guidée et mot de passe oublié sans issue. |
| 10 | Aide | 1 | Relance réseau présente ; aucune aide sur les méthodes ou la récupération d’accès. |
| **Total** | | **23/40** | **Acceptable, sous réserve du rendu sur appareil.** |

## Spécificité et impression

La photo de cuisine, le panneau moka et les mots du foyer ancrent visuellement la page dans Garde-manger (auth-shell.tsx, sign-in.tsx). Le choix d’une méthode et le secours en cas de problème restent ceux d’une page d’authentification générique : le fonctionnement d’une instance personnelle n’est pas expliqué. L’occasion la plus nette est de rendre le parcours fiable selon la configuration réelle du serveur, puis de rendre chaque choix compréhensible sans alourdir le premier écran.

Le détecteur Impeccable a renvoyé **0 constat** sur la route sign-in.tsx ([], code 0). Ce résultat ne couvre pas le rendu natif des composants délégués. Aucun faux positif n’a été émis ; aucune surcouche visuelle n’a pu être affichée faute de simulateur démarré et de page navigateur pour cette cible Expo.

## Ce qui fonctionne

- Deux onglets nommés, un panneau cohérent avec l’identité chaude du produit et un indicateur de sélection ; les transitions respectent la réduction des animations (auth-mode-pager.tsx, auth-shell.tsx).
- Le retour du formulaire e-mail au choix des méthodes conserve la saisie ; les deux pages restent montées pendant le balayage (auth-method-footer.tsx, auth-mode-pager.tsx).
- Les boutons signalent l’attente, les erreurs sont annoncées, et chaque icône fournisseur possède un nom accessible (auth-button.tsx, auth-error.tsx, auth-provider-button.tsx).

## Problèmes prioritaires

1. **P1 — E-mail et inscription restent proposés quand le mot de passe est désactivé.** auth-method-footer.tsx:191 affiche le bouton sans consulter la méthode password ; le serveur peut la retirer et désactiver emailAndPassword (backend/src/infrastructure/auth/auth-methods.provider.ts:9, backend/src/infrastructure/auth/better-auth/instance.ts:69). L’utilisateur peut saisir un formulaire voué à échouer. **Correction :** faire dépendre l’option e-mail et l’onglet d’inscription des méthodes retournées, avec un état initial pendant leur chargement. **Commande :** $impeccable harden.
2. **P1 — Mot de passe oublié sans sortie.** login-form.tsx:31-61 ne propose ni récupération ni marche à suivre, et aucune route de réinitialisation n’a été trouvée dans le dépôt. Une personne dont le mot de passe est perdu ne peut pas terminer sa connexion e-mail. **Correction :** fournir un vrai parcours de réinitialisation ou une consigne de contact avec l’administrateur de son instance, selon ce que le backend prend en charge. **Commande :** $impeccable harden.
3. **P2 — L’arrivée des méthodes alternatives est silencieuse.** Pendant useAuthMethodsQuery(), seul le bouton e-mail est visible ; les autres méthodes apparaissent après la réponse (auth-method-footer.tsx:75-95,190-194). La variation de hauteur est animée, mais rien ne dit qu’une recherche est en cours. **Correction :** afficher un court état de recherche ou réserver l’espace de la rangée pendant le chargement. **Commande :** $impeccable clarify.
4. **P2 — Les pictogrammes seuls exigent de reconnaître PocketID et la clé d’accès.** Quand au moins deux fournisseurs sont disponibles, leurs noms ne sont donnés qu’à l’accessibilité (auth-method-footer.tsx:197-240, auth-provider-button.tsx:39-43). Cette disposition suit la préférence explicite de boutons uniquement iconiques ; le risque concerne surtout une première visite. **Correction compatible avec ce choix :** fournir un indice au survol, au focus ou à l’appui long, et vérifier l’identification des icônes avec des utilisateurs. **Commande :** $impeccable clarify.
5. **P2 — La photo pré-auth part directement vers Unsplash.** kitchen-photo.ts:10 et auth-photo-background.tsx:22 créent une requête externe avant connexion, alors que PRODUCT.md dit que les appels mobiles externes passent par le backend. La photo peut manquer hors ligne et le comportement contredit la promesse de l’instance personnelle. **Correction :** embarquer cette image ou la servir depuis l’instance. **Commande :** $impeccable harden.

## Charge cognitive et parcours émotionnel

**Charge modérée : 2 critères sur 8 échouent.** La divulgation progressive fonctionne pour le formulaire e-mail ; les points faibles sont le nombre maximal de choix (e-mail plus quatre fournisseurs) et la reconnaissance des pictogrammes sans légende visible. Le moment rassurant est l’arrivée sur une page chaleureuse, reliée au reste du produit. Le creux apparaît quand une méthode attendue n’est pas encore chargée ou quand un mot de passe perdu n’a aucune issue. Le passage après succès n’a pas été observé sur appareil.

## Alertes par persona

- **Jordan, première visite :** comprend les onglets et le bouton e-mail, mais doit deviner PocketID et la clé d’accès à partir de leurs icônes.
- **Casey, mobile distrait :** peut commencer à taper son e-mail avant que les autres options n’apparaissent, puis hésiter sur la méthode réellement utilisée par son foyer.
- **Sam, lecteur d’écran :** profite des libellés des boutons et des erreurs annoncées ; le chargement des méthodes et l’erreur liée à un champ précis demandent une annonce plus explicite.

## Observations mineures

- auth-shell.tsx utilise des retraits de zone de sécurité fixes : le comportement avec clavier, encoche, orientation paysage et grands caractères doit être vu sur iPhone et Android avant de conclure à un défaut.
- Les champs de login-form.tsx n’indiquent pas explicitement les attributs d’autoremplissage ni une action de clavier « suivant/connexion » ; l’effet réel dépend du système et demande un contrôle sur appareil.
- signup-form.tsx montre la force du mot de passe, mais pas les exigences du serveur avant la saisie.

## Questions de conception

Comment montrer immédiatement « la méthode de mon foyer » lorsque le serveur ne propose qu’un fournisseur ? Comment garder la rangée iconique voulue tout en rendant PocketID et la clé d’accès reconnaissables à la première visite ?
