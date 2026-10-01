# Observabilité — faire tourner, vérifier, exploiter

Décision et justifications : `docs/adr/0011`. Ce document-ci est opérationnel.

## Architecture

```
  App mobile (Expo)                          Backend (AdonisJS)
  ─────────────────                          ──────────────────
  apiFetch()                                 instrumentation.js (--import)
    │  span client                             │  HTTP entrant  (instrumentation-http)
    │  header traceparent  ───────────────▶    │  fetch sortant (instrumentation-undici)
    │                                          │  PostgreSQL    (instrumentation-pg)
    │  batch OTLP/JSON toutes les 15 s         │  logs pino     (instrumentation-pino)
    ▼                                          │  runtime Node  (instrumentation-runtime-node)
  POST /api/telemetry/v1/{traces,logs}         │
    │  quota + plafond de taille + liste       │ OTLP/HTTP (proto)
    │  blanche d'attributs + pseudonymisation  │
    └──────────────┐              ┌────────────┘
                   ▼              ▼
              OpenTelemetry Collector          :4317 gRPC / :4318 HTTP (loopback)
                   │  memory_limiter → filter → redaction → batch
                   │  spanmetrics (métriques RED dérivées des spans)
                   │  file d'attente sur disque + retry
                   ▼
              OpenObserve                      :5080 UI + API (loopback)
                   logs · traces · métriques, rétention 30 j
```

Le `traceparent` du mobile est le mécanisme principal de corrélation : le backend
continue la trace au lieu d'en ouvrir une nouvelle, donc `GET /api/recipes` depuis le
téléphone, le span HTTP serveur, les spans PostgreSQL et l'appel sortant au fournisseur
d'IA portent tous le même `trace_id`.

## Démarrer

```bash
cp -n .env.example .env            # puis changer OPENOBSERVE_ROOT_PASSWORD
task up                            # db + backend + otel-collector + openobserve
open http://127.0.0.1:5080         # identifiants = OPENOBSERVE_ROOT_*
```

Sans l'observabilité :

```bash
task up:app-only                   # db + backend uniquement
task obs:down                      # ou : arrêter les deux conteneurs à chaud
```

En développement (`task dev`, backend sur l'hôte) : le script `dev` charge déjà
`--import ./instrumentation.js`. Il faut que `backend/.env` contienne les variables
`OTEL_*` / `TELEMETRY_*` de `backend/.env.example` — un `.env` déjà existant n'est pas
mis à jour par `task setup` (`cp -n`), donc ces lignes sont à recopier à la main. Le
Collector, lui, écoute sur `127.0.0.1:4318` dès que `task up` a tourné.

### Changer les identifiants OpenObserve

Le Collector s'authentifie en Basic auth avec les mêmes identifiants :

```bash
echo -n "vous@example.com:votre-mot-de-passe" | base64   # → OTLP_STORE_AUTH
```

`OPENOBSERVE_ROOT_EMAIL`, `OPENOBSERVE_ROOT_PASSWORD` et `OTLP_STORE_AUTH` doivent
rester cohérents. Le mot de passe n'est lu qu'à la création du compte racine : le
changer après coup demande de le changer aussi dans l'UI.

## Vérifier

**1 — Le backend exporte des traces.**

```bash
curl -s http://localhost:3333/api/auth/methods > /dev/null
```

Dans OpenObserve → *Traces*, filtrer sur `service_name = 'garde-manger-backend'`. La trace
contient le span HTTP serveur et les spans `pg` de la requête. `/health` n'apparaît
jamais : il est filtré côté SDK *et* côté Collector.

**2 — Les logs arrivent et portent le trace_id.**

Dans *Logs*, stream `default`. Chaque ligne émise pendant une requête porte `trace_id`
et `span_id` — c'est `instrumentation-pino` qui les injecte. Un clic mène à la trace.

**3 — Les métriques arrivent.**

Dans *Metrics* : `traces_span_metrics_duration_milliseconds` (dérivées par
`spanmetrics`, donc présentes pour le mobile *et* le backend) et les métriques runtime
Node (`nodejs_eventloop_delay_*`, heap, GC).

**4 — La corrélation mobile → backend fonctionne.**

Lancer l'app avec `EXPO_PUBLIC_TELEMETRY_ENABLED=true`, ouvrir un écran qui charge des
données, attendre 15 s (ou mettre l'app en arrière-plan, ce qui force un flush).
Dans *Traces*, filtrer `service_name = 'garde-manger-mobile'`, ouvrir une trace : elle
contient le span client du téléphone **et**, sous lui, le span serveur, les spans
PostgreSQL et les appels sortants. Un seul `trace_id` du haut en bas.

Le même contrôle en une commande, sans téléphone :

```bash
TRACEPARENT="00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01"
curl -s -H "traceparent: $TRACEPARENT" http://localhost:3333/api/auth/methods > /dev/null
echo "$TRACEPARENT"      # chercher ce trace_id dans OpenObserve
```

**5 — Une panne de l'observabilité ne casse pas l'application.**

```bash
docker compose stop otel-collector openobserve
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3333/health          # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3333/api/auth/methods # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'content-type: application/json' -d '{"resourceSpans":[]}' \
  http://localhost:3333/api/telemetry/v1/traces                                 # 202
docker compose start otel-collector openobserve
```

L'app mobile se comporte pareil : les batches échouent, le backoff monte jusqu'à 5
minutes, la file est plafonnée à 256 éléments et les plus anciens sont jetés. Aucun
écran ne bloque, aucune requête ne rate.

Les tests automatisés couvrent la même propriété : `backend/tests/functional/telemetry`,
`backend/tests/infrastructure/telemetry` (liste blanche, troncature, corrélation), et
`mobile/src/infrastructure/telemetry/telemetry.test.ts` (en-tête `traceparent`, export
qui échoue sans que la requête échoue).

## Ce qui n'est jamais collecté

Refusé par construction, pas par convention :

| Donnée | Où c'est bloqué |
|---|---|
| `authorization`, `cookie`, `set-cookie` | jamais capturés par le SDK (`headersToSpanAttributes` non configuré) ; `redact` de pino ; processeur `attributes/redact` du Collector |
| mots de passe, tokens, secrets, clés d'API | `redact` de pino ; regex de rédaction du Collector ; liste blanche du relais |
| paramètres de requêtes SQL | `enhancedDatabaseReporting: false` |
| chaînes de requête d'URL | `url.query` supprimé par le Collector ; le mobile n'envoie que `url.path` |
| identifiants d'appareil, IDFA, langue, opérateur | jamais émis par `resource.ts`, et absents de la liste blanche du relais |
| corps de requête, structures imbriquées | `otlp-sanitizer.ts` ne garde que les valeurs OTLP scalaires |
| identifiant utilisateur en clair | remplacé par `enduser.pseudo.id`, HMAC-SHA256 tronqué, clé = `APP_KEY` |

Les erreurs d'authentification côté mobile ne remontent qu'un nom d'opération et un
`error.type` — jamais le message de l'erreur, qui peut contenir ce qu'on était en train
de vérifier. L'objet brut reste affiché en développement (`__DEV__`), sur une console
locale.

## Exploitation

**Volume et rétention.** `OBSERVABILITY_RETENTION_DAYS` (30 par défaut) borne le disque.
Le volume `openobserve-data` est le seul à sauvegarder ; s'il est perdu, on perd
l'historique, pas l'application.

**Échantillonnage.** À un foyer, tout garder (`OTEL_TRACES_SAMPLER_ARG=1.0`) est le bon
réglage. Si le volume devient gênant : baisser d'abord `EXPO_PUBLIC_TELEMETRY_SAMPLE_RATIO`
côté mobile — la décision se propage au backend via le flag du `traceparent`, donc une
trace échantillonnée l'est de bout en bout.

**Cardinalité.** Les dimensions de `spanmetrics` sont volontairement au nombre de trois
(`http.route`, `http.response.status_code`, `service.version`). Ajouter un identifiant
d'utilisateur ou de produit y ferait exploser le nombre de séries.

**Exposition.** `OBSERVABILITY_BIND` vaut `127.0.0.1`. Le Collector n'a aucune
authentification : le passer à `0.0.0.0` publie un point d'ingestion ouvert sur le
réseau local. Pour accéder à l'UI à distance, la faire passer par le reverse proxy du
homelab, avec TLS.

**Quotas.** `TELEMETRY_RATE_LIMIT_PER_MINUTE` (60) est un compteur en mémoire de
processus, par compte ou par IP. Avec plusieurs réplicas du backend, la limite effective
devient `limite × réplicas` ; à un seul conteneur, c'est exact.

**Mises à jour.** Les images sont épinglées dans `compose.yml`. Le Collector et
OpenObserve se mettent à jour indépendamment de l'application.

## Changer de backend de stockage

Un seul bloc bouge, dans `observability/otel-collector.yaml` :

```yaml
exporters:
  otlphttp/store:
    endpoint: ${env:OTLP_STORE_ENDPOINT}   # p. ex. http://signoz-otel-collector:4318
    headers:
      Authorization: Basic ${env:OTLP_STORE_AUTH}
```

Plus le compose du nouveau backend. Aucun code applicatif, aucune variable côté mobile.


## Convention de logging — audit Rootprint du 30 septembre 2026

Cette convention s'applique aux actions backend (`traceAction`), aux exceptions HTTP,
à Better Auth et à la résolution de session, ainsi qu'au client HTTP/session Expo
sur Android, iOS et web. Le site vitrine `landing` n'exécute pas ces parcours de session.
La politique pure est identique dans `backend/src/domain/shared/log-diagnostic.ts` et
`mobile/src/domain/shared/log-diagnostic.ts` ; un test de parité empêche leur divergence.

### Niveaux et résultats

| Niveau | Utilisation | `event.outcome` |
| --- | --- | --- |
| INFO | Succès backend ; refus attendu (`unauthenticated`, `no_household`, `owner_cannot_leave`, identifiants invalides ou session expirée) | `success` ou `refused` |
| WARN | Autre refus HTTP 4xx, validation ou avertissement de dépendance | `refused` ou `failure` |
| ERROR | Exception inattendue, réseau/stockage indisponible, timeout de session, réponse illisible, HTTP 5xx | `failure` |

Un 5xx reste ERROR même s'il porte un code de refus métier. Un refus connu peut être
escaladé selon le contexte via `TraceActionOptions.failureLevel` ou `recordError.level`.
Le gestionnaire HTTP respecte aussi les exclusions Adonis (`shouldReport`). Les alias
historiques `action`, `outcome` et `error.type` restent disponibles là où ils existaient ;
utiliser les champs communs ci-dessous pour les nouveaux tableaux de bord.

### Champs communs et déploiement

| Dimension | Champ canonique | Backend | Expo mobile / web |
| --- | --- | --- | --- |
| Service | `service.name` | `garde-manger-backend` (ou `OTEL_SERVICE_NAME`) | `garde-manger-mobile` / `garde-manger-web` |
| Environnement du producteur | `deployment.environment.name` | `DEPLOY_ENV`, puis `NODE_ENV` | `EXPO_PUBLIC_APP_ENV`, puis mode dev/prod |
| Version | `service.version` | `APP_VERSION` | version Expo |
| Build | `service.build` | `APP_BUILD`, puis version | `EXPO_PUBLIC_APP_BUILD`, puis numéro iOS/Android, puis version |
| Plateforme | `os.name` | `node` | `android`, `ios`, `web` |
| Opération | `app.operation` | nom d'action ou méthode + route modèle | nom d'action ou méthode + chemin sans query |
| Résultat | `event.outcome` | `success`, `refused`, `failure` | `refused`, `failure` |
| Code stable | `error.code` | code applicatif, SQLSTATE, statut HTTP ou `unexpected_error` | code Better Auth/API ou code technique ci-dessous |

Les ressources OTLP et les logs stdout backend portent les dimensions de service,
environnement, version/build et plateforme. Le Collector complète uniquement un
environnement absent : il ne remplace plus celui du client par son propre `DEPLOY_ENV`.
Les images backend et Expo web produites par la CI embarquent le SHA Git comme build.
Pour un lancement local, configurer `APP_BUILD` dans l'environnement backend ; pour
un build natif, configurer `EXPO_PUBLIC_APP_BUILD` ou les numéros de build Expo.
Renseigner `APP_VERSION` au déploiement : `0.0.0` est un fallback, pas une version de release.
Aucun build, déploiement ou redémarrage n'est effectué par ce changement de code.

Dans Rootprint, filtrer sur les champs canoniques (ou leurs noms aplatis par
l'ingestion) et distinguer d'abord `event.outcome=failure` de `refused`. Le code et
l'opération doivent figurer dans toute tâche créée à partir d'un incident.

### Diagnostic et corrélation

La récupération de session émet `session_timeout` après 5 secondes, un code Better Auth
lorsqu'il existe, `session_http_<status>` pour une erreur HTTP sans code, ou
`session_fetch_failed` comme fallback technique. Une erreur backend antérieure au
contrôleur porte `identity.resolve_session` et `session_resolution_failed` à défaut
d'un code plus précis. L'absence normale de session n'émet pas d'erreur.

Les autres phases distinguent `cookie_read_failed`, `network_error`, `invalid_response`
et les codes API. Les logs techniques conservent `exception.type`, un
`exception.message` sûr, `exception.cause` (profondeur maximale 3) et
`exception.stacktrace` (20 positions de frames maximum). Les objets Better Auth sont
identifiés comme `StructuredError`, plutôt que `unknown`. Les messages réseau connus
sont conservés ; certaines erreurs réseau/JSON sont reformulées sans leurs valeurs
interpolées. Tout autre message libre est marqué `[redacted diagnostic message]`.
Les stacks gardent fichier/ligne/colonne, sans chemin absolu, URL, arguments ou message.

`traceparent` est maintenant injecté aussi dans `authClient.getSession`. Avec la
collecte activée, le log client et les logs backend peuvent être rapprochés par la trace
(`traceId` OTLP / `trace_id` Pino). Les requêtes HTTP et la récupération de session conservent aussi le
`request_id` renvoyé via `x-request-id`, exposé par CORS. Il sert de fallback pour
une réponse en erreur ou illisible lorsque le client n'a pas de span. Une erreur
réseau survenue avant l'envoi n'a naturellement pas de log backend correspondant.

### Répétitions

- Un échec transport est enregistré à sa source, sans second log dans le catch appelant.
- Une exception déjà enregistrée dans cette requête n'est pas réémise par le gestionnaire HTTP.
- Les refus INFO de même opération/code/statut/entité encore dans la file client sont
  regroupés sur une fenêtre maximale de 15 secondes : `event.occurrences` conserve le
  nombre et le premier log conserve sa trace. Les spans HTTP restent individuels.
- Les erreurs techniques et les avertissements restent distincts. Cette stratégie ne
  masque pas deux exceptions similaires provenant de requêtes différentes.
- Un export partiellement réussi remet en file seulement le signal en échec. Le
  backoff reste plafonné à 5 minutes et chaque file à 256 événements ; le compteur de
  pertes existant reste disponible. Comme tout export HTTP, une réponse perdue après
  acceptation peut entraîner une retransmission : aucune garantie « exactly once ».

### Protection et exemples synthétiques

La liste blanche est appliquée avant émission client et à nouveau au relais. Les
payloads auth, headers, objets libres et messages arbitraires ne sont jamais émis dans
les parcours modifiés. Pino masque les clés de secrets connues et les emails, et ses
serializers `err`/`error` ne gardent que les diagnostics sûrs. Le relais filtre aussi
les corps libres, les messages de statut de span et les identifiants de trace invalides.
Les logs d'action n'ajoutent plus `userId` ni `householdId` ; les identifiants métier
ciblés peuvent rester utiles. La pseudonymisation HMAC du relais reste en place.

Exemples synthétiques, avec dimensions de ressource aplaties pour la lecture :

```json
{"severityText":"ERROR","service.name":"garde-manger-mobile","deployment.environment.name":"production","service.version":"1.0.0","service.build":"42","os.name":"ios","app.operation":"identity.get_session","event.outcome":"failure","error.code":"session_timeout","exception.type":"TimeoutError","exception.message":"Session request timed out","event.occurrences":1}
{"severityText":"INFO","service.name":"garde-manger-web","deployment.environment.name":"production","service.version":"1.0.0","service.build":"demo-build","os.name":"web","app.operation":"identity.leave_household","event.outcome":"refused","error.code":"owner_cannot_leave","http.response.status_code":409,"event.occurrences":3}
```

Ces exemples ne contiennent ni compte réel, ni cookie/token, ni secret. Les fixtures de
régression injectent volontairement mot de passe, token, email, chemin privé et cause
cyclique afin de vérifier leur exclusion.

### Validation de la livraison

Tests écrits ou adaptés : politique de diagnostic/masquage, refus backend, propagation
et timeout de session, réponse JSON invalide corrélée, regroupement des occurrences,
erreurs techniques distinctes, relais et export partiellement réussi. Ils ne sont pas
exécutés automatiquement, conformément à `AGENTS.md`.

Après déploiement dans un environnement de validation, vérifier dans Rootprint :

- Session inaccessible/timeout : ERROR, code précis et contexte technique sûr.
- Session absente, aucun foyer, propriétaire qui quitte : refus INFO, pas incident ERROR.
- Appel HTTP en erreur : retrouver la trace backend ou le `request_id` de réponse.
- Filtres service/environnement/version/build/plateforme/opération renseignés ; environnement client conservé.
- Polling répété : compteur de refus ; incidents techniques distincts et pas de renvoi d'un export réussi.
- Échantillons réels : absence de credentials, cookies, email, payload auth et chemins privés.

Cette vérification en environnement n'a pas été effectuée dans cette livraison locale.
