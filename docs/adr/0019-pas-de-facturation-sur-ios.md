# ADR-0019 — StoreKit sur iOS, Stripe sur Android et web

> Décision révisée pour #110, 21 octobre 2026. Elle remplace le renvoi vers
> le web de #59 / #63 ainsi que la désactivation temporaire des achats iOS.

## Décision

- iOS propose un abonnement mensuel via le dialogue natif StoreKit 2, avec
  restauration et gestion native. Le prix localisé provient de l’App Store.
- Android et web conservent Stripe Checkout et Customer Portal.
- Les achats des deux services donnent le même droit au foyer. Un foyer déjà
  abonné ne reçoit pas de deuxième offre d’achat. Aucun transfert automatique
  de facturation ou double facturation volontaire n’est introduit.
- Le backend vérifie chaque transaction Apple et son état courant avant
  d’accorder le droit. Les données Apple sont stockées séparément des données
  Stripe, puis réunies en lecture. Notifications signées, expirations,
  remboursements et reprises sont pris en charge.
- Aucun lien d’achat externe sur iOS ni exception régionale n’est utilisé.
  Le même produit intégré doit être disponible dans les vitrines distribuées.
- Les instances auto-hébergées restent illimitées et sans facturation.
- `platformCapabilities.billing` désigne toujours Stripe ; `storeKit` désigne
  l’achat natif iOS. Les écrans passent par `useAiSubscribe` pour choisir le
  parcours et afficher la bonne action de gestion.

## Conséquences

Une nouvelle build native et une configuration App Store Connect sont nécessaires.
La disponibilité réelle du produit, les scénarios sandbox/production et les preuves
sur appareils physiques restent des conditions de soumission, pas des faits acquis
par la revue du code. La suppression de compte n’annule pas un abonnement Apple ;
l’utilisateur en est informé et peut le résilier dans son compte Apple.

Configuration, déploiement, sécurité et retour arrière :
[StoreKit](../store/ios/storekit.md).
Preuves et note App Review : [resoumission](../app-store-resubmission.md).

Sources : [Apple 3.1.1 / 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase),
[bibliothèque serveur Apple](https://github.com/apple/app-store-server-library-node).
