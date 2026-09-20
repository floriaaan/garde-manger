# Tâches IA asynchrones — Design

**Statut :** proposé (2026-09-20), révision 1, en attente de validation

## Contexte

Les trois appels IA de l'app sont synchrones et bloquent une requête HTTP pendant
10 à 30 secondes (plusieurs minutes avec Ollama en local) :

| Appel                                     | Durée observée              | Écran             |
| ----------------------------------------- | --------------------------- | ----------------- |
| `POST /api/receipts/scan`                 | 10-30 s (1 appel vision)    | Relecture ticket  |
| `POST /api/products/scan` × N               | 10-30 s × N photos (N ≤ 5)  | Relecture frigo   |
| `POST /api/recipes/generate`              | 10-30 s (1 appel texte)     | Composeur recette |

Conséquences actuelles :

- l'utilisateur est prisonnier de l'écran ; quitter l'écran annule tout le travail
  (la photo n'existe que sur le téléphone) ;
- le multi-photo du frigo est orchestré côté mobile (`use-fridge-scan.ts`), donc
  perdu si l'app passe en arrière-plan assez longtemps pour que la JS runtime soit
  suspendue ;
- une coupure réseau à la 28ᵉ seconde consomme le quota IA sans rien rendre ;
- le résultat d'une extraction n'existe nulle part côté serveur : il n'y a rien à
  reprendre.

Ce chantier introduit une file de tâches persistante, un brouillon de scan
reprenable, et un retour in-app (centre de tâches + pastille de progression +
toast actionnable).

### Décisions prises en amont (2026-09-20)

1. **Les trois tâches passent en asynchrone** : scan de ticket, scan de frigo
   (les N photos deviennent **une seule tâche** côté serveur), génération de recettes.
   `GET /api/recipes/suggestions` reste synchrone (hors scope).
2. **Retour in-app d'abord, push serveur en V2.** Polling + centre de tâches +
   toast actionnable. Aucune dépendance nouvelle côté mobile, fonctionne en Expo Go
   et en self-hosted. Le push serveur (table `push_token`, Expo Push API, dev build
   EAS) est mutualisé avec le chantier 2 de la roadmap (notifications de péremption)
   et fera l'objet de sa propre spec.
3. **File Postgres avec `FOR UPDATE SKIP LOCKED`**, pas de RabbitMQ ni de Redis.
   Un broker AMQP transporte des messages mais ne stocke ni l'état ni le résultat
   d'une tâche : il faudrait de toute façon une table pour que le mobile puisse
   interroger `jobId`. Il ajouterait un service (~150 Mo) sur une cible self-hosted
   annoncée à ~2 Go de RAM, pour résoudre un problème de routage/débit que nous
   n'avons pas (quelques tâches par minute et par foyer). `SKIP LOCKED` est le
   mécanisme de pg-boss, graphile-worker, Oban et Solid Queue : transactionnel avec
   le brouillon, survit au redémarrage, compatible multi-nœuds sans changement.
4. **Nouvel agrégat brouillon** (`scan_draft`) : le résultat d'un scan est persisté,
   partagé dans le foyer, reprenable après avoir quitté l'écran.

### Conséquence : la photo devient une donnée serveur

Aujourd'hui la photo est uploadée et jetée dans la même requête. Un travailleur qui
s'exécute après la réponse HTTP ne peut pas lire un fichier temporaire : **l'upload
persiste désormais l'image via `shared.storage`** avant d'accuser réception.

Effet de bord bienvenu : `POST /api/receipts/import` peut enfin renseigner
`receipt.imageKey` (aujourd'hui figé à `null` faute de chemin d'écriture), donc
`GET /api/receipts/:id/image` sert enfin quelque chose. Les photos de frigo, elles,
sont purgées après import ou expiration du brouillon.

---

## 1. Backend

### 1.1 Nouveau contexte `job`

Un contexte à part entière (`domain/job`, `application/job`, `infrastructure/database/job`,
`presentation/job`), pas un ajout dans `shared` : il a son agrégat, son cycle de vie,
ses endpoints. Il dépend des cas d'usage `receipt` / `fridge` / `recipe` — légal, la
règle `application-only-depends-on-domain` n'interdit que `infrastructure` et
`presentation`.

### 1.2 Migrations

**`1785200000023_create_ai_job_table.ts`**

| Colonne         | Type          | Notes                                                                      |
| --------------- | ------------- | -------------------------------------------------------------------------- |
| `id`            | `text` PK     | `shared.idGenerator`                                                        |
| `household_id`  | `text` FK     | `household.id`, `on delete cascade`                                        |
| `created_by`    | `text` FK     | `user.id` — qui a lancé la tâche, affiché dans le centre de tâches         |
| `kind`          | `text`        | `receipt_scan` \| `fridge_scan` \| `recipe_generation`                      |
| `status`        | `text`        | `queued` \| `running` \| `succeeded` \| `failed`                            |
| `input`         | `jsonb`       | immuable — `{ imageKeys: string[] }` ou `{ prompt?: string }`               |
| `progress`      | `jsonb`       | `{ total: number, done: number, failed: number[] }`                         |
| `result`        | `jsonb` null  | `{ draftId }` ou `{ recipeIds }`                                            |
| `error_type`    | `text` null   | clé de `error-serializer.ts` (`provider_not_configured`, `extraction_failed`…) |
| `attempts`      | `int`         | défaut 0                                                                    |
| `run_at`        | `timestamptz` | défaut `now()` — porte le backoff                                           |
| `locked_at`     | `timestamptz` null | bail du travailleur, pour la reprise d'orphelins                      |
| `dismissed_at`  | `timestamptz` null | masqué du centre de tâches                                            |
| `started_at`    | `timestamptz` null |                                                                       |
| `finished_at`   | `timestamptz` null |                                                                       |
| `created_at`    | `timestamptz` |                                                                             |

Index :

- `ai_job_claim_idx` sur `(run_at)` `where status = 'queued'` — l'index de la boucle
  de claim, partiel pour rester minuscule quelle que soit la taille de l'historique ;
- `ai_job_household_idx` sur `(household_id, created_at desc)` — le centre de tâches ;
- `ai_job_running_household_idx` sur `(household_id)` `where status = 'running'` —
  la contrainte « une tâche à la fois par foyer ».

**`1785200000024_create_scan_draft_table.ts`**

| Colonne        | Type          | Notes                                                        |
| -------------- | ------------- | ------------------------------------------------------------ |
| `id`           | `text` PK     |                                                              |
| `household_id` | `text` FK     | cascade                                                      |
| `job_id`       | `text` FK     | `ai_job.id`, cascade                                         |
| `kind`         | `text`        | `receipt` \| `fridge`                                        |
| `payload`      | `jsonb`       | `ReceiptDraft` ou `FridgeScanDraft`, tel que parsé           |
| `image_keys`   | `jsonb`       | les clés `shared.storage` à purger (ou à rattacher au ticket) |
| `status`       | `text`        | `pending` \| `imported` \| `discarded`                       |
| `expires_at`   | `timestamptz` | `created_at + SCAN_DRAFT_TTL_HOURS`                          |
| `created_at`   | `timestamptz` |                                                              |

Index `(household_id, status, created_at desc)`.

Aucun champ n'est interrogé à l'intérieur de `payload` : `jsonb` plutôt qu'une
table `scan_draft_item`. Les formes sont déjà décrites et validées par les parseurs
du domaine (`receipt-draft-parser.ts`, `fridge-scan-draft-parser.ts`).

### 1.3 Domaine

`domain/job/job.aggregate.ts`

```ts
export type JobKind = 'receipt_scan' | 'fridge_scan' | 'recipe_generation'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface JobProgress { total: number; done: number; failed: number[] }

export class Job {
  // create(), markRunning(), recordUnit(index, ok), succeed(result),
  // fail(errorType), scheduleRetry(now) — transitions pures, testées sans base.
}
```

`domain/job/retry-policy.ts` — fonction pure, la seule règle non triviale :

```ts
const MAX_ATTEMPTS = 3
const FATAL: readonly string[] = ['provider_not_configured', 'ai_quota_exceeded']

/** `null` = ne pas réessayer. Sinon, la date du prochain essai. */
export function nextAttemptAt(errorType: string, attempts: number, now: Date): Date | null
```

Backoff `10 s × 2^(attempts-1)` (10 s, 20 s, puis abandon).
`provider_not_configured` et `ai_quota_exceeded` échouent immédiatement : aucun
réessai ne corrige une clé absente ni un quota épuisé. `extraction_failed` /
`generation_failed` **sont** réessayés (un LLM est non déterministe, un second appel
sur la même photo réussit souvent).

`domain/job/interfaces/job-repository.interface.ts`

```ts
export interface JobRepository {
  save(job: Job): Promise<void>
  findById(id: string): Promise<Job | null>
  listForHousehold(householdId: string, since: Date): Promise<Job[]>
  /** Réclame atomiquement une tâche exécutable. `null` = rien à faire. */
  claimNext(now: Date): Promise<Job | null>
  /** Remet en file les tâches dont le bail a expiré (process tué en plein vol). */
  requeueExpiredLeases(before: Date): Promise<number>
}
```

`domain/fridge/fridge-scan-merge.ts` — **déplacé** depuis
`mobile/src/domain/fridge/fridge-scan-merge.ts`. L'orchestration multi-photos passe
côté serveur, donc la fusion aussi. Les tests existants côté mobile sont portés tels
quels. La copie mobile est supprimée avec `use-fridge-scan.ts`.

`domain/job/interfaces/scan-draft-repository.interface.ts` : `save`, `findById`,
`listPending(householdId)`, `markImported(id)`, `markDiscarded(id)`,
`deleteExpired(before)`.

### 1.4 Infrastructure — la file

`infrastructure/database/job/job.repository.ts`

`claimNext` est **une seule requête** : pas de transaction explicite, pas de
`SELECT` puis `UPDATE`.

```sql
update ai_job
   set status     = 'running',
       locked_at  = now(),
       attempts   = attempts + 1,
       started_at = coalesce(started_at, now())
 where id = (
   select id from ai_job
    where status = 'queued'
      and run_at <= now()
      and household_id not in (select household_id from ai_job where status = 'running')
    order by run_at
      for update skip locked
    limit 1
 )
returning *;
```

Deux garanties dans cette requête :

- `for update skip locked` : deux travailleurs (ou deux nœuds) ne peuvent pas
  réclamer la même ligne, et le second ne bloque pas — il prend la suivante ;
- `household_id not in (… running)` : **une tâche IA à la fois par foyer**. Protège
  le quota et les limites de débit des fournisseurs, et évite qu'un foyer qui lance
  cinq scans monopolise le travailleur.

`requeueExpiredLeases` :

```sql
update ai_job
   set status = 'queued', locked_at = null, run_at = now()
 where status = 'running'
   and locked_at < now() - interval '10 minutes';
```

Appelée au démarrage **et** à chaque tick. C'est la reprise après crash : un process
tué pendant un appel IA laisse une ligne `running` que personne ne libérerait
autrement. Le bail (10 min) est volontairement plus long que le timeout d'une unité
(2 min) pour qu'un scan frigo de 5 photos lentes ne soit jamais repris en double.

`infrastructure/job/job-runner.ts` — la boucle :

```
démarrage : requeueExpiredLeases(), puis tick toutes les 1 s
tick :
  si jobsEnCours >= JOB_MAX_CONCURRENCY → retour
  job = claimNext() ; si null → retour
  exécuter(job) sans await (le tick suivant peut réclamer une autre tâche)
```

Pas de `LISTEN/NOTIFY` : un tick d'une seconde est invisible à côté d'un appel IA de
20 secondes, et `NOTIFY` demanderait une connexion dédiée hors pool.

### 1.5 Application — l'exécution

`application/job/run-job.use-case.ts` répartit selon `kind` et réutilise **les cas
d'usage existants, inchangés** :

| `kind`               | Exécution                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `receipt_scan`       | lit l'image du storage → `ScanReceipt` → `scan_draft` (`kind: 'receipt'`)                          |
| `fridge_scan`        | pour chaque clé d'image → `ScanFridge` → `mergeScanItems` → `scan_draft` (`kind: 'fridge'`)        |
| `recipe_generation`  | `GenerateRecipes` (persiste déjà les recettes) → `result = { recipeIds }`                          |

Points d'exécution :

- **Par unité** (une photo = une unité) : timeout `JOB_UNIT_TIMEOUT_MS` (défaut
  120 000 ms — Ollama en local est lent), puis `progress.done++` ou
  `progress.failed.push(i)`. Une photo ratée n'annule pas les autres : c'est le
  comportement actuel de `use-fridge-scan.ts`, qu'on conserve, simplement déplacé.
- **Arrêt anticipé** : si une unité échoue sur `provider_not_configured` ou
  `ai_quota_exceeded`, les unités restantes ne sont pas tentées (garanties d'échouer
  pareil). Même règle que `BLOCKING_ERRORS` côté mobile aujourd'hui.
- **Succès partiel** : si au moins une unité rend des items, la tâche est
  `succeeded` avec `progress.failed` non vide. Le mobile affiche « 2 photos sur 5
  n'ont rien donné » et propose de relancer les manquantes.
- **Écriture transactionnelle** : le brouillon et le passage à `succeeded` sont
  commités ensemble. Pas de tâche terminée sans brouillon lisible.

`application/job/enqueue-job.use-case.ts` :

1. vérifie le quota IA **à l'enfilement** (`AiQuotaPort.usage`) — l'utilisateur voit
   le paywall tout de suite, pas trente secondes plus tard dans un centre de tâches ;
2. écrit les images via `shared.storage` sous `scan/{householdId}/{jobId}/{n}`;
3. crée la ligne `queued`.

Le quota est **consommé à l'exécution**, comme aujourd'hui (un appel fournisseur =
une unité, donc un scan frigo de 5 photos coûte 5). Cas résiduel assumé : le quota
peut être épuisé entre l'enfilement et l'exécution ; la tâche échoue alors en
`ai_quota_exceeded` et le centre de tâches affiche le paywall.

`application/job/retry-job.use-case.ts` : remet `queued`, `attempts = 0`,
`run_at = now()`. Si la tâche a déjà un brouillon et des `progress.failed`, seules
ces unités-là sont rejouées et leurs items fusionnés dans le brouillon existant.

`application/job/list-jobs.use-case.ts`, `dismiss-job.use-case.ts`,
`get-scan-draft.use-case.ts`, `discard-scan-draft.use-case.ts`,
`purge-expired-drafts.use-case.ts`.

### 1.6 Présentation — endpoints

```
POST   /api/jobs/receipt-scan       multipart `image`             → 202 { job }
POST   /api/jobs/fridge-scan        multipart `images[]` (1 à 5)  → 202 { job }
POST   /api/jobs/recipe-generation  { prompt?: string }           → 202 { job }
GET    /api/jobs                    (actives + terminées < 24 h, non masquées, max 20)
GET    /api/jobs/:id                → { job }
POST   /api/jobs/:id/retry          → 202 { job }
DELETE /api/jobs/:id                → 204  (annule si `queued`, masque sinon)
GET    /api/scan-drafts             → { drafts }  (pending du foyer)
GET    /api/scan-drafts/:id         → { draft }
DELETE /api/scan-drafts/:id         → 204  (abandon + purge des photos)
```

Tous derrière `middleware.householdRequired()`, tous tracés via `traceAction` avec
des `action:` nommés (`job.enqueue_receipt_scan`, `job.get_jobs`, `job.retry`…).

`POST /api/receipts/import` et `POST /api/products/import` gagnent un
`draftId?` optionnel : présent, le backend marque le brouillon `imported` dans la
même transaction, rattache l'image au ticket (`receipt.imageKey`) pour un ticket,
purge les photos pour un scan frigo.

**Les trois endpoints synchrones sont supprimés** (`POST /api/receipts/scan`,
`POST /api/products/scan`, `POST /api/recipes/generate`). Cette suppression n'est
correcte que parce que l'app n'est pas publiée (chantier 3 de la roadmap non
démarré) : aucun client déployé ne peut les appeler. À valider — si une build
`preview` circule déjà, on les garde dépréciés une release.

### 1.7 Cycle de vie du process

`providers/job_provider.ts` enregistre les liaisons et, dans `ready()`, démarre le
`JobRunner` si `JOB_WORKER_ENABLED` (défaut `true`). Dans `shutdown()`, le runner
arrête de réclamer et attend au plus 30 s les tâches en cours ; celles qui restent
sont reprises par le bail au redémarrage.

La purge (`purge-expired-drafts`) tourne dans le même tick, une fois par heure :
brouillons `expires_at` dépassé ou `discarded`, avec leurs images ; lignes `ai_job`
terminées de plus de 30 jours.

### 1.8 Nouvelles variables d'environnement

```dotenv
JOB_WORKER_ENABLED=true      # false pour un nœud purement HTTP
JOB_MAX_CONCURRENCY=2        # tâches en parallèle sur ce nœud
JOB_UNIT_TIMEOUT_MS=120000   # un appel IA (Ollama local est lent)
SCAN_DRAFT_TTL_HOURS=48      # durée de vie d'un brouillon non importé
```

Documentées dans `.env.example` et `start/env.ts`.

### 1.9 Observabilité (ADR-0011)

Le découplage casse la trace : la requête d'enfilement se termine avant l'appel IA.
À l'enfilement, le `traceparent` courant est stocké sur la ligne ; le travailleur
ouvre un span racine `job.run` (attributs `job.id`, `job.kind`, `job.attempt`,
`household.id`) portant un **span link** vers ce contexte. Les deux moitiés restent
navigables dans OpenObserve sans forcer une trace d'une minute.

Nouvelles métriques : `job.queue.depth` (jauge), `job.duration` (histogramme par
`kind`), `job.failed` (compteur par `error_type`).

---

## 2. Mobile

### 2.1 Connector

`FridgeConnector` gagne :

```ts
enqueueReceiptScan(imageUri: string): Promise<Result<Job, ApiError>>
enqueueFridgeScan(imageUris: string[]): Promise<Result<Job, ApiError>>
enqueueRecipeGeneration(prompt?: string): Promise<Result<Job, ApiError>>
getJobs(): Promise<Job[]>
getJob(jobId: string): Promise<Job | null>
retryJob(jobId: string): Promise<Result<Job, ApiError>>
dismissJob(jobId: string): Promise<Result<void, ApiError>>
getScanDraft(draftId: string): Promise<ScanDraft | null>
discardScanDraft(draftId: string): Promise<Result<void, ApiError>>
```

`scanReceipt`, `scanFridgePhoto` et `generateRecipes` disparaissent.
`importReceipt` / `importProducts` portent un `draftId?`.
`fake-fridge-connector.ts` implémente les mêmes méthodes en résolvant les tâches
après quelques ticks — c'est lui qui fait tourner toute la suite de tests.

### 2.2 Application

- `application/job/jobs.query.ts` — `defineQuery(['jobs'], …)`, avec
  `refetchInterval: (query) => hasActiveJob(query.state.data) ? 2000 : false`.
  Le polling s'éteint tout seul dès qu'il n'y a plus rien en cours : aucune requête
  périodique en régime permanent.
- `application/job/job.query.ts` — `['jobs', jobId]`, même règle, pour les écrans de
  relecture ouverts sur une tâche précise.
- `application/job/enqueue-*.mutation.ts` — sur succès, `setQueryData(['jobs'])`
  insère la tâche retournée : la pastille apparaît **immédiatement**, sans attendre
  le prochain poll. C'est la clé de la fluidité perçue.
- `application/job/use-job-notifications.ts` — mémorise le statut précédent de
  chaque tâche et détecte les transitions `active → succeeded | failed`.
- `application/shared/toast.ts` — `ToastMessage` gagne
  `action?: { label: string; onPress: () => void }` et une variante `success`.
- `providers/wire-focus-manager.ts` — branche `AppState` sur le `focusManager` de
  TanStack Query (≈ 8 lignes). Sans ça, revenir dans l'app après trente secondes en
  arrière-plan n'actualise rien : c'est précisément le scénario que ce chantier
  promet de rendre fluide.

### 2.3 Présentation

**`ProgressBar`** (`presentation/shared/progress-bar.tsx`) — **remplace `PulseDots`
sur les trois écrans d'attente IA**. Deux modes dans un seul composant :

- **déterminé** (`value` / `total`) : le scan de frigo sait où il en est (3 photos
  sur 5), la barre le montre. Transition animée à chaque incrément.
- **indéterminé** (`value` omis) : scan de ticket et génération de recette n'ont
  qu'une unité — une bande qui traverse la piste en boucle.

Même grammaire visuelle que `Meter` (piste `height={8}`, `borderRadius={999}`), même
règle Reduce Motion que `PulseDots` et `Skeleton` : sous Reduce Motion, la bande
indéterminée s'arrête et la piste reste remplie à 35 % — toujours lisible comme un
chargement, sans mouvement. `accessibilityRole="progressbar"` avec
`accessibilityValue` en mode déterminé, `accessibilityLabel` seul sinon.

`PulseDots` reste en place sur `boot-splash.tsx` et `empty-state-lottie.tsx` : ce
sont des attentes sans unité de travail ni fin annonçable, pas des tâches.

**`JobHost`** — monté à la racine à côté de `ToastHost` / `ConfettiHost`. Sur chaque
transition terminale, un toast actionnable :

| Tâche                | Succès                                                | Échec                                               |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `receipt_scan`       | « Ticket analysé — 14 articles » → **Relire**         | intitulé de `ApiError` → **Réessayer** ou **Voir**   |
| `fridge_scan`        | « Frigo analysé — 23 produits » → **Relire**          | idem                                                |
| `recipe_generation`  | « 3 recettes prêtes » → **Voir** (+ confetti existant) | idem                                                |

**`ActiveJobPill`** — pastille ancrée au-dessus de la barre d'onglets tant qu'au
moins une tâche est active : libellé de la tâche, progression (« Analyse du frigo —
3/5 »), barre de progression (`ProgressBar`). Appui → `/tasks`. C'est l'élément qui rend
« continuer à naviguer » évident plutôt que possible.

**`/tasks` — centre de tâches** (écran poussé, frère de `/receipts` dans le `Stack`
racine ; entrée depuis la pastille et depuis l'en-tête du dashboard quand une tâche
est active). Une carte par tâche : icône du type, auteur, heure relative, état, et
**une** action principale selon l'état :

| État                        | Action                          |
| --------------------------- | ------------------------------- |
| `queued`                    | *En attente* — pas d'action     |
| `running`                   | progression, pas d'action       |
| `succeeded` (scan)          | **Relire**                      |
| `succeeded` (recettes)      | **Voir les recettes**           |
| `succeeded`, `failed` ≠ []  | **Relancer les photos manquantes** + **Relire** |
| `failed` réessayable        | **Réessayer**                   |
| `failed` quota              | **Voir l'abonnement** (`ConnectedPaywall` existant) |
| `failed` provider           | message, pas de réessai (comportement actuel de `toScanError`) |

Balayage → `dismissJob`.

**Écrans modifiés**

- `receipt-scanner-screen.tsx` : capture → `enqueueReceiptScan` → `router.replace('/receipts/review?jobId=…')`.
- `receipt-review-screen.tsx` : lit `jobId` (ou `draftId` si rouvert depuis
  `/tasks`) au lieu de lancer la mutation. Les trois états de l'écran (attente /
  résultat / erreur) et `toScanError` sont **conservés tels quels** — seule la
  source change. Nouveauté : un bouton **« Je reviens plus tard »** pendant
  l'attente, qui renvoie au dashboard sans rien perdre.
- `fridge-scan-camera-screen.tsx` : « Analyser (N) » → `enqueueFridgeScan` →
  `/fridge-scan/review?jobId=…`.
- `fridge-scan-review-screen.tsx` : `use-fridge-scan.ts` **supprimé** ; les états
  par photo viennent de `job.progress`. La relance ciblée remplace le réessai par
  photo.
- `recipe-generate-screen.tsx` : `GeneratingState` reste, alimenté par la tâche, ses
  `PulseDots` remplacés par `ProgressBar` indéterminé, et gagne le même « Je reviens
  plus tard ». Le confetti existant se déclenche depuis `JobHost`, pas depuis
  l'écran — il doit tomber même si l'utilisateur est ailleurs.
- `dashboard` : bandeau « Brouillon à relire » quand `GET /api/scan-drafts` renvoie
  un brouillon `pending` — c'est le filet pour qui a fermé l'app entre-temps.

### 2.4 Ce qu'on ne persiste pas

Les corrections saisies dans l'écran de relecture restent **locales à l'écran** : le
brouillon serveur porte ce que l'IA a extrait, l'import porte la version corrigée.
Pas de `PATCH /api/scan-drafts/:id`. Un brouillon co-éditable par deux membres en
même temps est une autre fonctionnalité (conflits, ordre des écritures, présence) ;
si le besoin apparaît, le chemin est un `PATCH` sur `payload` et un
`updated_at` optimiste.

Conséquence assumée : quitter la relecture **en cours d'édition** fait perdre les
corrections, pas l'extraction.

---

## 3. Hors scope explicite

| Écarté                          | Pourquoi / quand l'ajouter                                                    |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Push serveur (Expo Push API)    | Décision 2 — V2, mutualisé avec les notifications de péremption (chantier 2).  |
| SSE / WebSocket                 | Un poll à 2 s sur une tâche de 20 s est indiscernable, et n'impose aucune configuration de reverse-proxy aux self-hostés. À revoir si la progression doit être fine. |
| RabbitMQ / Redis / BullMQ       | Décision 3. À revoir si plusieurs nœuds backend ou > 10 tâches/s.              |
| `pg-boss`                       | Rentable quand il faudra du cron (chantier 2). Aujourd'hui : 3 types de tâches, ~80 lignes, zéro dépendance. |
| `GET /api/recipes/suggestions`  | Reste synchrone (décision 1). Même patron le jour où sa latence dérange.        |
| Édition serveur du brouillon    | Voir 2.4.                                                                      |
| Annulation d'une tâche `running`| Seules les `queued` s'annulent. Interrompre un appel fournisseur déjà facturé n'économise rien. |

---

## 4. Tests

**Backend (unitaires, sans base)**

- `retry-policy` : fatal vs réessayable, backoff, plafond à 3.
- Transitions de `Job` : `recordUnit`, succès partiel, échec bloquant.
- `fridge-scan-merge` : les tests portés depuis le mobile.
- `RunJob` avec ports en double : succès, succès partiel, arrêt sur erreur
  bloquante, timeout d'unité.

**Backend (intégration, base réelle)**

- `claimNext` : deux appels concurrents ne rendent jamais la même ligne
  (`SKIP LOCKED`).
- `claimNext` respecte « une tâche à la fois par foyer ».
- `requeueExpiredLeases` récupère une ligne `running` dont le bail a expiré.
- Le brouillon et le passage à `succeeded` sont commités ensemble (rollback ⇒ ni
  l'un ni l'autre).
- Purge : brouillon expiré supprimé avec ses images.

**Backend (fonctionnels)**

- Enfilement → 202 avec l'id ; quota dépassé → 402 **sans** créer de ligne ni écrire
  d'image.
- Cloisonnement foyer : `GET /api/jobs/:id` d'un autre foyer → 404.
- Import avec `draftId` : brouillon `imported`, `receipt.imageKey` renseigné,
  deuxième import du même brouillon rejeté.

**Mobile**

- `jobs.query` : le polling démarre à l'enfilement et s'arrête à la fin.
- `JobHost` : une transition terminale produit un toast, une seule fois.
- `ActiveJobPill` : visible pendant, absente après.
- Écrans de relecture ouverts sur `jobId` puis sur `draftId` (reprise).
- `/tasks` : une action par état, y compris la relance ciblée.
- `fake-fridge-connector` : les tests d'écran existants tournent dessus sans réseau.

---

## 5. Questions ouvertes à trancher à la validation

1. **TTL du brouillon** : 48 h proposé. Plus long = plus de photos stockées.
2. **Conservation de la photo de ticket** : la rattacher à `receipt.imageKey` fait
   croître le volume `storage` sans limite. La roadmap (chantier 3) prévoit une
   politique de rétention — on l'anticipe ou on la reporte ?
3. **Entrée du centre de tâches** : uniquement la pastille + l'en-tête du dashboard,
   ou un onglet à part entière ?
4. **Suppression des endpoints synchrones** : confirmée seulement si aucune build
   `preview` ne circule.
5. **Timeout d'unité à 120 s** : suffisant pour un `llava` sur CPU ? À caler sur une
   mesure réelle si quelqu'un tourne en Ollama local.

## 6. ADR à écrire après validation

- **ADR-0016 — File de tâches en Postgres plutôt qu'un broker** : `SKIP LOCKED`,
  pourquoi pas RabbitMQ/Redis, et le seuil à partir duquel on changerait d'avis.
- **ADR-0017 — Brouillon de scan persistant** : pourquoi un agrégat plutôt qu'un
  résultat éphémère attaché à la tâche, et pourquoi il n'est pas éditable côté
  serveur.
