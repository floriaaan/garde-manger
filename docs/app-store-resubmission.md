# Resoumission App Store — #109, #110, #111

État : correctifs de code préparés ; aucune validation sur appareil physique,
vidéo ni mise à jour App Store Connect réalisée dans cette PR. Ne pas clôturer
les issues sur la seule base de la revue du code.

## Préparation

Déployer le backend de la PR avant la build iOS. Installer cette build sur un
iPhone et un iPad physiques, avec un compte jetable sans données personnelles.
Noter version/build, version du backend, modèle, OS, vitrine du compte Apple et
date. Ne pas utiliser une exemption de quota pour le compte de revue : iOS
utilise le quota gratuit pour tous les foyers de l’instance officielle.

## #109 — Permission caméra (5.1.1(iv))

1. Sur une installation dont l’autorisation caméra est indéterminée, ouvrir
   Scan > Code-barres : le dialogue système iOS apparaît directement, sans
   fenêtre préalable ni bouton « Autoriser la caméra » de l’application.
2. Autoriser : le scanner s’ouvre. Fermer et rouvrir : aucun nouveau dialogue.
3. Sur une nouvelle autorisation indéterminée, refuser : vérifier le lien Réglages,
   la fermeture et « Saisir le produit manuellement ». Revenir au scanner : pas
   de nouvelle demande. Vérifier aussi le retour au formulaire déjà ouvert.
4. Autoriser depuis Réglages iOS puis revenir dans l’app : le scanner s’ouvre
   sans relancer une demande. Vérifier le cas restreint (contrôle parental).
5. Vérifier la même absence de pré-dialogue pour les scans ticket, frigo et QR
   d’invitation ; leurs alternatives existantes restent accessibles.

## #110 — Achats numériques (3.1.1)

Politique identique pour toutes les vitrines prises en charge : aucun achat
ni avantage de quota payant sur iOS, aucun lien externe de souscription.
Aucune exception régionale n’est invoquée. Référence et décision : ADR-0019.

Sur chaque vitrine proposée dans App Store Connect (au minimum France/UE,
États-Unis et une vitrine hors UE/US si distribuée), vérifier avec un foyer
gratuit puis un foyer disposant déjà d’un abonnement Stripe :

- Réglages : pas d’entrée Abonnement. Ouvrir `gardemanger://subscription` :
  usage IA uniquement, aucun prix, offre, lien web ou action de paiement.
- Quota atteint : scans ticket/frigo, génération, suggestions et reprise d’une
  tâche restent refusés au quota gratuit ; aucune incitation à acheter.
- Une souscription réalisée sur le web n’augmente pas le quota iOS.
- Les endpoints checkout et portal appelés avec `x-client-platform: ios`
  répondent `billing_unavailable` ; aucun navigateur de paiement ne s’ouvre.
- Web/Android : les parcours Stripe restent disponibles. Sur serveur
  auto-hébergé : l’IA reste illimitée sans carte d’achat.

Les usages sont comptés par foyer, toutes plateformes confondues : des appels
web peuvent donc aussi épuiser le quota gratuit disponible sur iOS.

## #111 — Suppression et vidéo (5.1.1(v))

Enregistrer sans coupure le parcours sur iPhone/iPad physique :

1. Créer un compte jetable, puis se déconnecter et se reconnecter pour montrer
   clairement l’authentification. Utiliser un foyer solo pour le parcours principal.
2. Ouvrir Réglages > Mon compte > Supprimer mon compte. Montrer le texte
   d’irréversibilité, saisir le mot de passe si demandé, confirmer la suppression.
3. Montrer la page « Compte supprimé », puis tenter une connexion avec l’ancien
   compte : elle doit échouer. La confirmation n’apparaît qu’après succès API.
4. Vérifier séparément `gardemanger://delete-account` et la route web
   `/delete-account` : si déconnecté, connexion puis retour à la suppression.
5. Vérifier un membre simple, une connexion sociale sans mot de passe et un
   propriétaire de foyer partagé. Ce dernier doit transférer la propriété via
   le lien Foyer, puis pouvoir revenir terminer la suppression.
6. Vérifier un mot de passe incorrect et une erreur réseau : rester sur l’écran
   de suppression avec erreur, sans confirmation de succès.

Téléverser la vidéo sur un lien accessible aux reviewers sans authentification.
Renseigner ce lien dans App Review Information Notes et répondre dans
Resolution Center. Aucun lien de preuve n’est fourni tant que l’enregistrement
n’a pas été réalisé. Ne pas enregistrer de mot de passe ou de compte de production.

## Preuves à renseigner avant soumission

| Issue / scénario | Appareil / OS | Build / backend | Vitrine | Date / résultat | Preuve |
| --- | --- | --- | --- | --- | --- |
| #109 autoriser / refuser / restreint / réglages | À renseigner | À renseigner | À renseigner | Non exécuté | À joindre |
| #110 gratuit / abonné / quota / reprise | À renseigner | À renseigner | Chaque vitrine ciblée | Non exécuté | À joindre |
| #111 connexion / suppression / confirmation | iPhone + iPad | À renseigner | À renseigner | Non exécuté | Vidéo à joindre |

## Proposition de note App Review (à compléter après validation)

Camera: Opening a scanner requests the native iOS camera permission directly.
After denial, users can open Settings or use the available manual/import path.

Purchases: This iOS build offers no paid digital unlocks or external purchase
prompts in any storefront. Hosted AI uses the same free quota on iOS for all
households, including households with a web subscription. No regional external
purchase entitlement is used.

Account deletion: Sign in, then open Settings > Account > Delete my account.
Confirm deletion (password required for email/password accounts). A success
screen confirms permanent account deletion and sign-out. Shared household
owners first transfer ownership from the Household screen.
Recording URL: [REQUIRED — insert the actual accessible physical-device recording].
Reviewed build/device/storefront/date: [REQUIRED — insert actual evidence].

Ne pas envoyer cette note avec les champs entre crochets non renseignés.
