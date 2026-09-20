*English · [Français](README.fr.md)*

# Garde-manger

The household's shared pantry: inventory, expiry dates, a shared shopping list, receipts scanned in one photo, and recipes with what's left. Open source, MIT licensed.

Two ways to use it:

- **Hosted** — hosted for you, free for the essentials, subscription for the AI. _Not open yet._
- **Self-hosted** — the API runs at home, the app only ever talks to your server. That's what the rest of this document covers.

## Installation

You need a machine with Docker (Compose v2), on the same network as the phones. Budget a few hundred MB of RAM (~2 GB more with observability).

### 1. Create the compose file

The images are built by the CI and published on GHCR: no clone, no build. Save this as `docker-compose.yml` on your server:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: garde_manger
      POSTGRES_PASSWORD: CHANGE_ME_DB_PASSWORD
      POSTGRES_DB: garde_manger
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U garde_manger -d garde_manger']
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    image: ghcr.io/floriaaan/garde-manger-backend:main
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - '3333:3333'
    volumes:
      - storage:/app/data
    # Lets OLLAMA_BASE_URL reach an Ollama running on the host (Linux too).
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 3333
      LOG_LEVEL: info

      # Secrets: generate each with `openssl rand -base64 32`
      APP_KEY: CHANGE_ME
      BETTER_AUTH_SECRET: CHANGE_ME
      ENCRYPTION_KEY: CHANGE_ME

      # How the phones reach the API: LAN IP or public domain, never localhost
      APP_URL: http://192.168.1.42:3333
      NETWORK_URL: http://192.168.1.42:3333
      # exp:// = Expo Go, gardemanger:// = the installed app
      CORS_ORIGIN: exp://,gardemanger://

      DB_HOST: db
      DB_PORT: 5432
      DB_USER: garde_manger
      DB_PASSWORD: CHANGE_ME_DB_PASSWORD
      DB_DATABASE: garde_manger
      STORAGE_ROOT: /app/data/storage

      # Sign-in (PocketID / Google are enabled when their variables are set)
      DISABLE_PASSWORD_LOGIN: 'false'
      POCKETID_ISSUER_URL: ''
      POCKETID_CLIENT_ID: ''
      POCKETID_CLIENT_SECRET: ''
      GOOGLE_CLIENT_ID: ''
      GOOGLE_CLIENT_SECRET: ''

      # AI: receipt scan + recipes. Fill at least one provider.
      AI_PROVIDER: gemini
      GEMINI_API_KEY: ''
      OPENAI_API_KEY: ''
      OLLAMA_BASE_URL: ''            # e.g. http://host.docker.internal:11434
      OLLAMA_VISION_MODEL: ''        # e.g. llava
      OLLAMA_TEXT_MODEL: ''          # e.g. llama3.1

      HOME_ASSISTANT_ALLOWED_HOSTS: ''

      PUBLIC_STATS_ENABLED: 'false'
      DEPLOY_ENV: production
      APP_VERSION: main

      # Observability off: no collector in this file
      OTEL_ENABLED: 'false'
      OTEL_SERVICE_NAME: garde-manger-backend
      TELEMETRY_INGEST_ENABLED: 'false'

volumes:
  pgdata:
  storage:
```

Then fill in the values:

```bash
# Prints three secrets: paste them into APP_KEY, BETTER_AUTH_SECRET and ENCRYPTION_KEY
for k in APP_KEY BETTER_AUTH_SECRET ENCRYPTION_KEY; do echo "$k=$(openssl rand -base64 32)"; done

ipconfig getifaddr en0          # your server's IP on macOS
hostname -I | awk '{print $1}'  # ... on Linux
```

- `APP_URL` and `NETWORK_URL`: your server's address as seen by the phones (`http://192.168.1.42:3333`), not `localhost`.
- `CHANGE_ME_DB_PASSWORD`: the same password in both places (`db` and `backend`).
- At least one AI provider, otherwise receipt scanning and recipes stay off.

### 2. Start

```bash
docker compose up -d
```

Database migrations run automatically on startup. Check:

```bash
curl http://localhost:3333/health
# {"status":"ok"}
```

This runs Postgres and the API, without observability (see [Observability](#observability)).

### 3. Run the app on your phone

The app isn't on the stores yet. In the meantime it runs in [Expo Go](https://expo.dev/go) (App Store / Play Store), from a computer on the same network with `git` and Node.js 24+:

```bash
git clone https://github.com/floriaaan/garde-manger.git && cd garde-manger
corepack enable
pnpm install
cp mobile/.env.example mobile/.env
```

In `mobile/.env`, point the app at your server (not `localhost` — it's the phone making the calls):

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.42:3333
```

```bash
cd mobile && pnpm start
```

Scan the QR code with the camera app (iOS) or Expo Go (Android), create an account, then a household. Other members create their own account and join the household with its invite code.

> If the connection fails with an origin error, check that `CORS_ORIGIN` in your compose file includes `exp://` (Expo Go) — that's the default value.

## Configuration

Everything is set in the `environment:` block of the `backend` service, then `docker compose up -d` to apply.

### AI (receipt scanning, recipes)

Without a provider, everything works except these two features. Scans and recipe generation run as background jobs (a Postgres queue, [ADR 0016](docs/adr/0016-file-de-taches-ia-postgres.md)): the app polls, and you can leave the screen while the AI works. The in-process worker is controlled by `JOB_WORKER_ENABLED` and `JOB_MAX_CONCURRENCY`. Set at least one provider:

```dotenv
AI_PROVIDER=gemini          # gemini | openai | ollama
GEMINI_API_KEY=...
OPENAI_API_KEY=...

# Or a local model, nothing leaves your home:
OLLAMA_BASE_URL=http://host.docker.internal:11434   # Ollama installed on the server
OLLAMA_VISION_MODEL=llava                           # must read images
OLLAMA_TEXT_MODEL=llama3.1
```

The active provider can then be switched at runtime from the app's settings ([ADR 0007](docs/adr/0007-provider-ia-changeable-a-chaud.md)).

Self-hosted instances are never rate-limited on AI usage. Only the official hosted
instance (`INSTANCE_MODE=hosted`) applies a per-household monthly quota, raised by an
in-app subscription ([ADR 0014](docs/adr/0014-abonnement-ia-par-foyer-via-revenuecat.md), [ADR 0015](docs/adr/0015-paiement-stripe-sans-stores.md)).

### Sign-in via PocketID (optional)

```dotenv
POCKETID_ISSUER_URL=https://auth.example.com
POCKETID_CLIENT_ID=...
POCKETID_CLIENT_SECRET=...
DISABLE_PASSWORD_LOGIN=false   # true = PocketID only
```

On PocketID's side, the redirect URL is based on `NETWORK_URL` ([ADR 0005](docs/adr/0005-auth-methods-endpoint-decouverte.md)).

### Observability

Off in the compose file above. To enable it (OpenTelemetry Collector + OpenObserve), use the repository's [`compose.yml`](compose.yml) with its [`.env.example`](.env.example) instead. Change `OPENOBSERVE_ROOT_EMAIL`, `OPENOBSERVE_ROOT_PASSWORD` and `OTLP_STORE_AUTH` together before exposing anything. Details in [docs/observabilite.md](docs/observabilite.md).

## Day to day

```bash
docker compose pull && docker compose up -d   # update (migrations included)
docker compose logs -f backend             # API logs
docker compose down                        # stop (data stays)
```

Data lives in two Docker volumes: `pgdata` (the database) and `storage` (receipt and product photos). Database backup:

```bash
docker compose exec db pg_dump -U garde_manger garde_manger > garde-manger.sql
```

## Developing

| Folder                | What                                                       |
| ---------------------- | ----------------------------------------------------------- |
| [`backend/`](backend)  | AdonisJS API, Postgres, better-auth                          |
| [`mobile/`](mobile)    | Expo app (iOS / Android) — [README](mobile/README.md)        |
| [`landing/`](landing)  | TanStack Start marketing site — [README](landing/README.md)  |
| [`docs/`](docs)        | Architecture decisions ([ADR](docs/adr)), roadmap             |

Tasks go through [Task](https://taskfile.dev):

```bash
task setup   # dependencies + copy the .env files
task dev     # Postgres in Docker + API locally (HMR)
task mobile:dev
task check   # lint, typecheck, tests, layer boundaries
```

Each package follows the same layering: `domain/`, `application/`, `infrastructure/`, `presentation/`.

## License

[MIT](LICENSE).
