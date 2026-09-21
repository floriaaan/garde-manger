*[English](README.md) · Français*

# Garde-manger

Le garde-manger partagé du foyer : inventaire, dates de péremption, liste de courses commune, tickets de caisse ou frigo scannés en une photo et recettes avec ce qui reste. Open source, licence MIT.

Deux façons de s’en servir :

- **Clé en main** — hébergé pour toi, gratuit pour l’essentiel, abonnement pour l’IA. _Pas encore ouvert._
- **Auto-hébergé** — l’API tourne chez toi, l’app ne parle qu’à ton serveur. C’est ce que décrit la suite.

## Installation

Il faut une machine avec Docker (Compose v2), sur le même réseau que les téléphones. Compte quelques centaines de Mo de RAM (~2 Go de plus avec la supervision).

### 1. Créer le fichier compose

Les images sont construites par la CI et publiées sur GHCR : pas de clone, pas de build. Enregistre ceci en `docker-compose.yml` sur ton serveur :

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
    # Permet à OLLAMA_BASE_URL de joindre un Ollama tournant sur l’hôte (Linux aussi).
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 3333
      LOG_LEVEL: info

      # Secrets : génère chacun avec `openssl rand -base64 32`
      APP_KEY: CHANGE_ME
      BETTER_AUTH_SECRET: CHANGE_ME
      ENCRYPTION_KEY: CHANGE_ME

      # Comment les téléphones joignent l’API : IP du réseau ou domaine public, jamais localhost
      APP_URL: http://192.168.1.42:3333
      NETWORK_URL: http://192.168.1.42:3333
      # exp:// = Expo Go, gardemanger:// = l’app installée
      CORS_ORIGIN: exp://,gardemanger://

      DB_HOST: db
      DB_PORT: 5432
      DB_USER: garde_manger
      DB_PASSWORD: CHANGE_ME_DB_PASSWORD
      DB_DATABASE: garde_manger
      STORAGE_ROOT: /app/data/storage

      # Connexion (PocketID / Google s’activent quand leurs variables sont renseignées)
      DISABLE_PASSWORD_LOGIN: 'false'
      POCKETID_ISSUER_URL: ''
      POCKETID_CLIENT_ID: ''
      POCKETID_CLIENT_SECRET: ''
      GOOGLE_CLIENT_ID: ''
      GOOGLE_CLIENT_SECRET: ''

      # IA : scan de tickets + recettes. Renseigne au moins un fournisseur.
      AI_PROVIDER: gemini
      GEMINI_API_KEY: ''
      OPENAI_API_KEY: ''
      OLLAMA_BASE_URL: ''            # ex. http://host.docker.internal:11434
      OLLAMA_VISION_MODEL: ''        # ex. llava
      OLLAMA_TEXT_MODEL: ''          # ex. llama3.1

      HOME_ASSISTANT_ALLOWED_HOSTS: ''

      # Instance. Ne pas toucher en auto-hébergé (aucun quota IA).
      PUBLIC_STATS_ENABLED: 'false'
      DEPLOY_ENV: production
      APP_VERSION: main

      # Supervision désactivée : pas de collecteur dans ce fichier
      OTEL_ENABLED: 'false'
      OTEL_SERVICE_NAME: garde-manger-backend
      TELEMETRY_INGEST_ENABLED: 'false'

volumes:
  pgdata:
  storage:
```

Puis renseigne les valeurs :

```bash
# Affiche trois secrets : colle-les dans APP_KEY, BETTER_AUTH_SECRET et ENCRYPTION_KEY
for k in APP_KEY BETTER_AUTH_SECRET ENCRYPTION_KEY; do echo "$k=$(openssl rand -base64 32)"; done

ipconfig getifaddr en0          # IP du serveur sur macOS
hostname -I | awk '{print $1}'  # ... sur Linux
```

- `APP_URL` et `NETWORK_URL` : l’adresse du serveur vue par les téléphones (`http://192.168.1.42:3333`), pas `localhost`.
- `CHANGE_ME_DB_PASSWORD` : le même mot de passe aux deux endroits (`db` et `backend`).
- Au moins un fournisseur IA, sinon le scan de tickets et les recettes restent désactivés.

### 2. Démarrer

```bash
docker compose up -d
```

Les migrations de la base passent toutes seules au démarrage. Vérifie :

```bash
curl http://localhost:3333/health
# {"status":"ok"}
```

Ça démarre Postgres et l’API, sans supervision (voir [Supervision](#supervision)).

### 3. Lancer l’app sur ton téléphone

L’app n’est pas encore sur les stores. En attendant, elle tourne dans [Expo Go](https://expo.dev/go) (App Store / Play Store), depuis un ordinateur du même réseau avec `git` et Node.js 24+ :

```bash
git clone https://github.com/floriaaan/garde-manger.git && cd garde-manger
corepack enable
pnpm install
cp mobile/.env.example mobile/.env
```

Dans `mobile/.env`, pointe l’app sur ton serveur (pas `localhost` : c’est le téléphone qui appelle) :

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.42:3333
```

```bash
cd mobile && pnpm start
```

Scanne le QR code avec l’appareil photo (iOS) ou Expo Go (Android), crée un compte, puis un foyer. Les autres membres créent leur propre compte et rejoignent le foyer avec son code d’invitation.

> Si la connexion échoue avec une erreur d’origine, vérifie que `CORS_ORIGIN` dans ton compose contient bien `exp://` (Expo Go) — c’est la valeur par défaut.

## Configuration

Tout se règle dans le bloc `environment:` du service `backend`, puis `docker compose up -d` pour appliquer.

### IA (scan de tickets et du frigo, recettes)

Sans fournisseur, tout marche sauf ces fonctionnalités (scan de tickets, scan du frigo, recettes). Sur l'instance hébergée, le scan du frigo fait partie de l'abonnement ; en auto-hébergé, il est inclus. Renseigne au moins un fournisseur :

```dotenv
AI_PROVIDER=gemini          # gemini | openai | ollama
GEMINI_API_KEY=...
OPENAI_API_KEY=...

# Ou un modèle local, rien ne sort de chez toi :
OLLAMA_BASE_URL=http://host.docker.internal:11434   # Ollama installé sur le serveur
OLLAMA_VISION_MODEL=llava                           # doit lire les images
OLLAMA_TEXT_MODEL=llama3.1
```

Le fournisseur actif se change ensuite à chaud depuis les réglages de l’app ([ADR 0007](docs/adr/0007-provider-ia-changeable-a-chaud.md)).

Une instance auto-hébergée n'est jamais plafonnée sur l'usage IA. Seule l'instance
officielle hébergée (`INSTANCE_MODE=hosted`) applique un quota mensuel par foyer,
relevé par un abonnement dans l'app ([ADR 0014](docs/adr/0014-abonnement-ia-par-foyer-via-revenuecat.md), [ADR 0015](docs/adr/0015-paiement-stripe-sans-stores.md)).

### Connexion via PocketID (optionnel)

```dotenv
POCKETID_ISSUER_URL=https://auth.example.com
POCKETID_CLIENT_ID=...
POCKETID_CLIENT_SECRET=...
DISABLE_PASSWORD_LOGIN=false   # true = PocketID uniquement
```

Côté PocketID, l’URL de redirection se base sur `NETWORK_URL` ([ADR 0005](docs/adr/0005-auth-methods-endpoint-decouverte.md)).

### Supervision

Désactivée dans le compose ci-dessus. Pour l’activer (OpenTelemetry Collector + OpenObserve), utilise plutôt le [`compose.yml`](compose.yml) du dépôt avec son [`.env.example`](.env.example). Change `OPENOBSERVE_ROOT_EMAIL`, `OPENOBSERVE_ROOT_PASSWORD` et `OTLP_STORE_AUTH` ensemble avant d’exposer quoi que ce soit. Détails dans [docs/observabilite.md](docs/observabilite.md).

## Au quotidien

```bash
docker compose pull && docker compose up -d   # mettre à jour (migrations incluses)
docker compose logs -f backend             # journaux de l’API
docker compose down                        # arrêter (les données restent)
```

Les données vivent dans deux volumes Docker : `pgdata` (la base) et `storage` (photos des tickets et produits). Sauvegarde de la base :

```bash
docker compose exec db pg_dump -U garde_manger garde_manger > garde-manger.sql
```

## Développer

| Dossier                | Quoi                                                     |
| ---------------------- | -------------------------------------------------------- |
| [`backend/`](backend)  | API AdonisJS, Postgres, better-auth                      |
| [`mobile/`](mobile)    | App Expo (iOS / Android) — [README](mobile/README.md)    |
| [`landing/`](landing)  | Site vitrine TanStack Start — [README](landing/README.md) |
| [`docs/`](docs)        | Décisions d’architecture ([ADR](docs/adr)), roadmap      |

Les tâches passent par [Task](https://taskfile.dev) :

```bash
task setup   # dépendances + copie des .env
task dev     # Postgres en Docker + API en local (HMR)
task mobile:dev
task check   # lint, typecheck, tests, frontières de couches
```

Chaque paquet suit la même organisation en couches `domain/`, `application/`, `infrastructure/`, `presentation/`.

## Licence

[MIT](LICENSE).
