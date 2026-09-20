# ADR-0018 — Notifications push via Expo Push API

## Contexte

Le dashboard montre ce qui expire, mais seulement si on ouvre l'app. Et une analyse IA
(ADR-0016) qui se termine pendant que l'app est en arrière-plan ne prévient personne.
Les deux besoins se règlent avec le même canal.

## Décision

- **Push serveur** (V1 de la roadmap, chantier 2), pas de notifications locales : un
  produit retiré par un autre membre du foyer ne doit pas déclencher de rappel périmé.
- **Table `push_token`** : un jeton Expo par appareil (unique), rattaché à un utilisateur.
  Se reconnecter sur l'appareil avec un autre compte déplace le jeton. Un jeton que
  Expo déclare mort (`DeviceNotRegistered`) est supprimé.
- **Deux envois** : la fin d'une tâche IA (réussie ou échouée, au créateur de la tâche,
  ouvre `/tasks`) et un digest quotidien de péremption (ouvre `/fridge`).
- **Digest par appareil**, à `PUSH_DIGEST_HOUR` (défaut 9 h) dans `PUSH_TIMEZONE` (défaut
  `Europe/Paris`), seuil de 2 jours (`findExpiringSoon`, qui exclut les produits déjà
  périmés). Idempotent grâce à `push_token.last_digest_on` : un redémarrage ou une
  seconde instance ne l'envoie jamais deux fois, et un serveur relancé après 9 h l'envoie
  quand même, une fois.
- **Scheduler en processus** (tick toutes les 5 min), démarré comme le worker de tâches
  dans le seul process web. Pas de cron externe : la même raison que pour la file (pas de
  broker à opérer).
- **Opt-in** depuis Réglages > Notifications : la demande de permission arrive au moment
  où l'utilisateur la comprend. Désactiver supprime le jeton côté serveur ; se déconnecter
  aussi (la préférence reste, pour la prochaine connexion).
- `PUSH_ENABLED=false` coupe l'envoi et le scheduler ; `EXPO_ACCESS_TOKEN` est facultatif.

## Conséquences

- Le push distant exige un **build de développement EAS** avec un `projectId` : Expo Go
  (SDK 53+) ne le reçoit pas. Sans `projectId`, l'activation répond « indisponible ».
- Un envoi raté est journalisé et abandonné : il ne fait jamais échouer une tâche.
- Le digest est le même pour tous les membres d'un foyer, mais envoyé par appareil : pas
  d'heure ni de seuil personnalisables (à ajouter si on le demande).
