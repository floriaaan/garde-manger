# ADR-0016 — File de tâches IA asynchrone adossée à Postgres

## Contexte

Le scan de ticket, le scan du frigo (jusqu'à 5 photos) et la génération de recettes
durent de quelques secondes à plus d'une minute. Traités dans la requête HTTP, ils
bloquaient l'écran, se perdaient si l'app passait en arrière-plan et faisaient échouer
tout le lot pour une seule photo illisible.

## Décision

- **Table `ai_job` comme file**, dans la base existante. Un worker réclame une tâche par
  un seul `UPDATE … FOR UPDATE SKIP LOCKED … RETURNING` : pas de double exécution, pas
  de broker à opérer (RabbitMQ, Redis) pour un volume de quelques tâches par minute.
- **Une tâche en cours par foyer** au maximum, bail de 10 minutes : un worker mort
  libère la tâche, qui repasse en file.
- **Reprises** : 3 tentatives, délai 10 s × 2^(n-1). `provider_not_configured` et
  `ai_quota_exceeded` sont fatales, réessayer ne les corrige pas.
- **`JobRunner` dans le process web** (tick 1 s, `JOB_MAX_CONCURRENCY`), démarré par
  `job_provider` uniquement en environnement web, arrêté avec 30 s de grâce.
  `JOB_WORKER_ENABLED=false` le coupe (tests, worker dédié plus tard).
- **Le quota est vérifié à l'enqueue** (402 immédiat, aucune ligne créée).
- **Photos persistées** sous `scan/{householdId}/{jobId}/{n}` : le worker s'exécute après
  la réponse HTTP.
- **Observabilité** : span `job.run` lié à la trace de la requête d'origine, métriques
  `job.duration`, `job.failed`, `job.queue.depth`.
- Les anciens endpoints synchrones (`/receipts/scan`, `/products/scan`,
  `/recipes/generate`) sont supprimés au profit de `POST /api/jobs/*`.
  `GET /recipes/suggestions` reste synchrone.

## Conséquences

- Le mobile interroge `GET /jobs` toutes les 2 s tant qu'une tâche est active, puis
  s'arrête. Pas de push en V1 (prévu en V2).
- Le worker partage le CPU et la base de l'API : à surveiller via `job.queue.depth` ;
  l'extraction vers un process dédié ne demande que de démarrer le runner ailleurs.
