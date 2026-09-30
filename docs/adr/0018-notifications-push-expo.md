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
  `Europe/Paris`). Le foyer choisit 0, 1, 2, 3 ou 7 jours (défaut 2). Les dates sont
  comparées en jours calendaires ; le stock est relu au moment de l'envoi. La date du
  jour reste éligible à 9 h. Chaque appareil est revendiqué atomiquement avant l'envoi
  pour éviter les doublons entre instances. Un échec d'envoi est journalisé et abandonné.
- **Scheduler en processus** (tick toutes les 5 min), démarré comme le worker de tâches
  dans le seul process web. Pas de cron externe : la même raison que pour la file (pas de
  broker à opérer).
- **Opt-in** depuis Réglages > Notifications : la demande de permission arrive au moment
  où l'utilisateur la comprend. Désactiver supprime le jeton côté serveur ; se déconnecter
  aussi (la préférence reste, pour la prochaine connexion).
- `PUSH_ENABLED=false` coupe l'envoi et le scheduler ; `EXPO_ACCESS_TOKEN` est facultatif.
- Sur le Web, l'abonnement du navigateur est stocké séparément des jetons Expo et livré
  par Web Push/VAPID. L'instance doit conserver `WEB_PUSH_VAPID_SUBJECT`,
  `WEB_PUSH_VAPID_PUBLIC_KEY` et `WEB_PUSH_VAPID_PRIVATE_KEY` entre les redémarrages.
  Sans ces trois valeurs, l'activation Web indique qu'elle est indisponible. HTTPS est
  requis (sauf localhost). Sur iPhone/iPad, le site doit être ajouté à l'écran d'accueil.

## Conséquences

- Le push distant exige un **build de développement EAS** avec un `projectId` : Expo Go
  (SDK 53+) ne le reçoit pas. Sans `projectId`, l'activation répond « indisponible ».
- Un envoi raté est journalisé et abandonné : il ne fait jamais échouer une tâche.
- Le délai est commun au foyer et modifiable par ses membres. Chaque membre active les
  notifications sur chacun de ses appareils. L'heure et le fuseau restent configurés par
  l'administrateur de l'instance, y compris en auto-hébergement.
