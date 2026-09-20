*English · [Français](README.fr.md)*

# Garde-manger

The household's shared pantry: inventory, expiry dates, a shared shopping list, receipts scanned in one photo, and recipes with what's left. Open source, MIT licensed.

Two ways to use it:

- **Hosted** — hosted for you, free for the essentials, subscription for the AI. _Not open yet._
- **Self-hosted** — the API runs at home, the app only ever talks to your server. That's what the rest of this document covers.

## Installation

You need a machine with Docker (Compose v2) and `git`, on the same network as the phones. Budget ~2 GB of RAM with observability, a few hundred MB without.

### 1. Get the code and configure

```bash
git clone https://github.com/floriaaan/fridge-ai.git && cd fridge-ai
cp .env.example .env

# Generates the three required secrets (APP_KEY, BETTER_AUTH_SECRET, ENCRYPTION_KEY)
for k in APP_KEY BETTER_AUTH_SECRET ENCRYPTION_KEY; do sed -i.bak "s|^$k=.*|$k=$(openssl rand -base64 32)|" .env; done; rm .env.bak
```

Then, in `.env`, replace `NETWORK_URL`'s IP with your server's address on your network:

```bash
ipconfig getifaddr en0          # macOS
hostname -I | awk '{print $1}'  # Linux
```

```dotenv
NETWORK_URL=http://192.168.1.42:3333
```

### 2. Start

```bash
docker compose up -d
```

The first run builds the API image (1 to 2 minutes). Database migrations run automatically on startup. Check:

```bash
curl http://localhost:3333/health
# {"status":"ok"}
```

This starts Postgres, the API, and observability (OpenTelemetry Collector + OpenObserve at http://127.0.0.1:5080). On a modest machine, without observability:

```bash
docker compose up -d db backend
```

### 3. Run the app on your phone

The app isn't on the stores yet. In the meantime it runs in [Expo Go](https://expo.dev/go) (App Store / Play Store), from a computer on the same network with Node.js 24+:

```bash
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

> If the connection fails with an origin error, check that `CORS_ORIGIN` in `.env` includes `exp://` (Expo Go) — that's the default value.

## Configuration

Everything is set in `.env` (commented), then `docker compose up -d` to apply.

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

Change `OPENOBSERVE_ROOT_EMAIL`, `OPENOBSERVE_ROOT_PASSWORD` and `OTLP_STORE_AUTH` together before exposing anything. Ports stay on `127.0.0.1`. Details in [docs/observabilite.md](docs/observabilite.md).

## Day to day

```bash
git pull && docker compose up -d --build   # update (migrations included)
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
