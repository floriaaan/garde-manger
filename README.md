*English · [Français](README.fr.md)*

<p align="center">
  <img src="landing/public/logo.png" alt="Logo Garde-manger" width="96" />
</p>

<h1 align="center">Garde-manger</h1>

The household's shared pantry: inventory, expiry dates, a shared shopping list, receipts or the fridge scanned in one photo, and recipes with what's left. Open source, MIT licensed.

<p align="center">
  <img src="landing/public/screenshots/accueil.jpg" alt="Home screen" width="260" />
  <img src="landing/public/screenshots/recettes.jpg" alt="Recipes screen" width="260" />
</p>

Two ways to use it:

- **Hosted** — hosted for you, free for the essentials, subscription for the AI.
- **Self-hosted** — the API runs at home, the app only ever talks to your server. That's what the rest of this document covers.

## Installation

You need a machine with Docker (Compose v2), on the same network as the phones. Budget a few hundred MB of RAM (~2 GB more with observability).

### 1. Create the compose file and the `.env`

The images are built by the CI and published on GHCR: no clone, no build. Save this as `docker-compose.yml` on your server. It has no secrets: they live in the `.env` next to it.

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: garde_manger
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: garde_manger
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U garde_manger -d garde_manger']
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    # Pin a version from the Releases page (e.g. 1.0.0) once one exists; main follows development
    image: ghcr.io/floriaaan/garde-manger-backend:${GARDE_MANGER_VERSION:-main}
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
    env_file: .env
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 3333
      LOG_LEVEL: info
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: garde_manger
      DB_DATABASE: garde_manger
      STORAGE_ROOT: /app/data/storage

volumes:
  pgdata:
  storage:
```

Then create the `.env` next to it. Replace `192.168.1.42` with your server's address as seen by the phones (LAN IP or domain, never `localhost`); the secrets are generated for you:

```bash
IP=192.168.1.42
# Your server's IP: ipconfig getifaddr en0 (macOS) · hostname -I | awk '{print $1}' (Linux)
cat > .env <<EOF
GARDE_MANGER_VERSION=main
DB_PASSWORD=$(openssl rand -hex 24)
APP_KEY=$(openssl rand -base64 32)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
APP_URL=http://$IP:3333
NETWORK_URL=http://$IP:3333
# exp:// = Expo Go, gardemanger:// = the installed app
CORS_ORIGIN=exp://,gardemanger://
# AI: receipt/fridge scan + recipes. Fill at least one provider (see Configuration).
AI_PROVIDER=gemini
GEMINI_API_KEY=
EOF
chmod 600 .env
```

- `APP_URL` and `NETWORK_URL`: the server's address as seen by the phones, not `localhost`.
- At least one AI provider, otherwise scanning and recipes stay off. Everything else has a sensible default: the full list is in [`.env.example`](.env.example).
- `.env` holds your secrets: keep it out of git and don't paste it anywhere (`chmod 600 .env`).

### 2. Start

```bash
docker compose up -d
```

Database migrations run automatically on startup. Check:

```bash
curl http://localhost:3333/health
# {"status":"ok"}
```

This runs Postgres and the API over plain HTTP, on your local network only. To expose it or protect sessions, see [HTTPS](#https). Without observability (see [Observability](#observability)).

### 3. Install the app on your phone

**Android**: download the latest `.apk` from the [Releases](https://github.com/floriaaan/garde-manger/releases/latest) page and open it (Android will ask you to allow installs from this source). On first launch choose **Self-hosted** and enter your server's address (`http://192.168.1.42:3333`, not `localhost`). Then create an account and a household. Other members create their own account and join the household with its invite code.

**iOS**: the app isn't on the App Store or TestFlight yet. In the meantime, use the Expo Go route below.

<details>
<summary>Expo Go (iOS, or to develop)</summary>

Temporary route: it runs in [Expo Go](https://expo.dev/go) from a computer on the same network with `git` and Node.js 24+:

```bash
git clone https://github.com/floriaaan/garde-manger.git && cd garde-manger
corepack enable
pnpm install
cp mobile/.env.example mobile/.env
```

In `mobile/.env`, point the app at your server (not `localhost`: it's the phone making the calls):

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.42:3333
```

```bash
cd mobile && pnpm start
```

Scan the QR code with the camera app (iOS) or Expo Go (Android).

> If the connection fails with an origin error, check that `CORS_ORIGIN` in your `.env` includes `exp://` (Expo Go).

</details>

## Configuration

Everything is set in the `.env` next to the compose file (the full list is in [`.env.example`](.env.example)), then `docker compose up -d` to apply.

### AI (receipt and fridge scanning, recipes)

Without a provider, everything works except these features (receipt scan, fridge scan, recipes). On the hosted instance, fridge scanning is part of the paid plan; self-hosted, it's included. Scans and recipe generation run as background jobs (a Postgres queue, [ADR 0016](docs/adr/0016-file-de-taches-ia-postgres.md)): the app polls, and you can leave the screen while the AI works. The in-process worker is controlled by `JOB_WORKER_ENABLED` and `JOB_MAX_CONCURRENCY`. Set at least one provider:

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

Off in the compose file above (`OTEL_ENABLED` and `TELEMETRY_INGEST_ENABLED` unset). To enable it (OpenTelemetry Collector + OpenObserve), use the repository's [`compose.yml`](compose.yml) with its [`.env.example`](.env.example) instead. Change `OPENOBSERVE_ROOT_EMAIL`, `OPENOBSERVE_ROOT_PASSWORD` and `OTLP_STORE_AUTH` together before exposing anything. Details in [docs/observabilite.md](docs/observabilite.md).

### HTTPS

The compose above serves plain HTTP: fine on a trusted home network, but sessions travel in clear text. To expose the server or protect them, put a reverse proxy in front. With [Caddy](https://caddyserver.com) (automatic certificates, needs a domain pointing at the server):

```yaml
  # add to docker-compose.yml, and remove `ports:` from the backend
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
```

```
# Caddyfile
garde-manger.example.com {
  reverse_proxy backend:3333
}
```

Add `caddy_data:` to the `volumes:` block, then set `APP_URL` and `NETWORK_URL` to `https://garde-manger.example.com` in `.env` and `EXPO_PUBLIC_API_URL` in the app.

## Day to day

```bash
docker compose logs -f backend             # API logs
docker compose down                        # stop (data stays)
```

Data lives in two Docker volumes: `pgdata` (the database) and `storage` (receipt and product photos).

### Updating

Migrations run automatically and can't be undone, so back up first, then move to a tagged version listed in the [changelog](CHANGELOG.md) (the [Releases](https://github.com/floriaaan/garde-manger/releases) page):

```bash
docker compose exec -T db pg_dump -U garde_manger garde_manger > garde-manger-$(date +%F).sql
# set GARDE_MANGER_VERSION=X.Y.Z in .env, then:
docker compose pull && docker compose up -d
```

Rolling back means restoring that dump on the previous version: keep the file until you're sure everything works. Also back up the `storage` volume if you care about photos.

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
