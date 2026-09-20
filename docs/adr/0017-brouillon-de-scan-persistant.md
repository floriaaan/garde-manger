# ADR-0017 — Brouillon de scan persistant (`scan_draft`)

## Contexte

Un scan asynchrone finit quand le membre n'est plus devant l'écran. Le résultat de l'IA
doit donc survivre à la navigation, à la fermeture de l'app et au changement d'appareil,
sans créer de produits ni de ticket tant que personne n'a relu.

## Décision

- **Agrégat `scan_draft`** (kind `receipt` ou `fridge`), créé par le worker en fin de
  tâche, atomiquement avec le passage de la tâche à `succeeded`.
- Le brouillon n'est **jamais** un produit ou un ticket : l'import (`POST /receipts`,
  `POST /products/import`) reçoit `draftId`, vérifie qu'il existe pour le foyer et le
  marque `imported`.
- Fridge : les photos sont **purgées** à l'import ou à l'abandon. Ticket : la photo
  devient `receipt.imageKey`.
- **Expiration à 48 h** (`SCAN_DRAFT_TTL_HOURS`) ; la purge horaire supprime aussi les
  tâches terminées de plus de 30 jours.
- Multi-photos : une seule tâche pour N photos, fusion côté serveur (`mergeScanItems`,
  même nom + même emplacement → quantité maximale). Une photo en échec n'invalide pas
  les autres ; la relance ne rejoue que les photos manquantes.

## Conséquences

- Le tableau de bord affiche « Brouillon à relire » tant qu'un brouillon est en attente.
- Un brouillon appartient au foyer : n'importe quel membre peut le relire.
