# ADR-0019 — Pas de facturation sur iOS

> Mise à jour — issue #59 : la décision de masquer l’accès à l’abonnement est
> remplacée par le parcours ci-dessous. Le contexte et la décision initiale
> sont conservés pour historique.

## Parcours actuel (#59)

- L’entrée « Abonnement » reste accessible depuis Réglages sur iOS pour les
  foyers de l’instance officielle. Le titre de la page est « Abonnement ».
- La page affiche le quota et réutilise les cartes d’offre et d’abonnement actif,
  avec leurs avantages, leur mascotte et le statut du foyer. Leur seule action
  est « Souscrire sur le web » ou « Gérer l’abonnement sur le web ». Sur iOS,
  la carte d’offre n’affiche ni prix, ni mentions de paiement Stripe, ni CGV ou
  renonciation à la rétractation. Aucun paiement ou portail de facturation n’est
  lancé par l’application iOS.
- `platformCapabilities.billing` désigne la facturation Stripe directe. Il
  reste `false` sur iOS : `useAiSubscribe()` ouvre à la place
  `https://app.gardemanger.floriaaan.fr/subscription` dans le navigateur,
  sans appeler les endpoints checkout/portal. Android et le web gardent leur
  parcours Stripe existant.
- La route web permet la connexion avec le même compte puis l’accès à
  l’abonnement. Le texte explique le passage par le navigateur et le retour
  dans l’application. Une erreur d’ouverture est affichée avec possibilité
  de réessayer ; le gestionnaire de focus existant actualise les réglages au
  retour au premier plan.
- Les serveurs auto-hébergés restent sans action de facturation. Les autres
  messages de quota et capacités de connexion ne changent pas.
- La mascotte du header du dashboard dépend du plan du foyer sur toutes les
  plateformes : dorée pour `subscriber`, normale sinon. La disponibilité de
  la facturation directe ne masque plus le statut d’abonnement sur iOS.

## Contexte

L'abonnement IA passe par Stripe (ADR-0015) : un paywall à 0,99 €/mois, un bouton
« S'abonner » qui ouvre Stripe Checkout, et le Customer Portal pour le payeur. L'ADR-0015
signalait déjà le risque pour les stores.

La règle 3.1.1 de l'App Store impose l'achat intégré (StoreKit) pour débloquer une
fonctionnalité numérique dans l'app. Un appel IA supplémentaire en est une. Elle interdit
aussi de renvoyer vers un autre moyen de paiement : bouton, lien, prix, ou simple mention.
Un paywall Stripe dans la build iOS est un refus quasi certain.

Options étudiées (état des règles à la rédaction, à revérifier avant chaque soumission) :

- **Achat intégré** (StoreKit, directement ou via RevenueCat) : c'est ce que l'ADR-0015 a
  quitté. Il faut un SDK natif, un second circuit d'abonnement à réconcilier avec Stripe
  pour le même foyer, et la commission Apple (15 % avec le Small Business Program).
- **États-Unis** : depuis l'injonction *Epic v. Apple* (avril 2025), la vitrine américaine
  autorise un bouton ou un lien vers un achat externe, sans entitlement ni commission.
  L'app vise d'abord la France, donc cette ouverture ne sert à rien ici.
- **Union européenne** (DMA) : un lien vers un achat externe est possible avec le
  *StoreKit External Purchase Link Entitlement*. Il faut le demander à Apple, afficher la
  feuille d'avertissement système avant la sortie de l'app, déclarer les transactions à
  Apple et payer ses frais sur les ventes externes. Beaucoup de travail et de frais pour
  un abonnement à 0,99 €.
- **Entitlement « reader »** (3.1.3(a)) : réservé aux apps de lecture (presse, livres,
  musique, vidéo). Garde-manger n'y a pas droit.
- **Aucune facturation sur iOS** : l'app iOS n'affiche ni l'abonnement, ni un prix, ni un
  lien de paiement. Le quota gratuit s'applique comme ailleurs.

## Décision

- **Pas de facturation sur iOS en v1.** Sur iOS, aucun écran ne propose l'abonnement, ne le
  nomme, ne donne de prix et ne renvoie vers Stripe, le Customer Portal ou les CGV de vente.
- **Une capacité, décidée une fois.** `capabilitiesFor(os)`
  (`mobile/src/domain/shared/platform-capabilities.ts`) dit ce que la plateforme peut
  proposer. `platformCapabilities` (`mobile/src/application/shared/platform-capabilities.ts`)
  l'évalue une seule fois pour `Platform.OS`. Aucun écran ne lit `Platform.OS` pour la
  facturation. Ils lisent `platformCapabilities.billing` ou `useAiSubscribe()`, dont
  `canSubscribe` vaut `false` sans facturation. Tous les paywalls (`ConnectedPaywall`)
  étaient déjà conditionnés à ce `canSubscribe`.
- **Écrans concernés sans facturation** : pas d'entrée « Abonnement » dans Réglages, pas de
  paywall ni de carte d'abonnement actif sur la route `/subscription` (titre « Quota IA »,
  seul le quota s'affiche), jauge de quota sans lien ni nom d'offre (« IA du foyer » au lieu
  de « Offre gratuite »), pas de mascotte dorée pour les foyers abonnés, et un texte neutre
  sur l'écran du fournisseur IA.
- **Quota épuisé** : un message neutre (« Quota du mois atteint. Il se renouvelle le 1er du
  mois. », ou le message du backend « Quota IA mensuel atteint (N). »), sans rien qui pousse
  à payer.
- **Backend inchangé.** Stripe, le webhook et les endpoints checkout/portal restent en place
  pour Android et le web. Le backend ne connaît pas la plateforme du client et n'a pas à
  la connaître : c'est une contrainte de distribution, pas une règle métier.

## Conséquences

- Un foyer abonné via Android ou le web garde son quota d'abonné sur iOS, mais l'app ne le
  dit pas. La règle 3.1.3(b) (services multiplateformes) ne tolère un accès acheté ailleurs
  que si l'achat existe aussi en achat intégré. C'est un risque de relecture assumé : rien
  n'est vendu ni mis en avant sur iOS, et le cas reste rare tant que la facturation n'est
  proposée qu'hors iOS.
- Un utilisateur iOS de l'instance officielle ne peut pas dépasser le quota gratuit depuis
  son iPhone. Il peut s'abonner depuis un autre appareil du foyer.
- Ajouter l'achat intégré plus tard revient à faire passer `billing` à `true` sur iOS, avec
  un autre circuit derrière `useAiSubscribe()` (StoreKit au lieu de Stripe). Les écrans
  n'auront pas à changer.
- La connexion Google suit le même mécanisme de capacités (ADR-0020).
- Revoir cette décision si l'app sort sur la vitrine américaine (lien externe permis) ou si
  les frais de l'entitlement européen baissent.
