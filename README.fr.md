*[English](README.md) · Français*

<p align="center">
  <img src="landing/public/logo.png" alt="Logo Garde-manger" width="96" />
</p>

<h1 align="center">Garde-manger</h1>

Le garde-manger partagé du foyer : inventaire, dates de péremption, liste de courses commune, tickets de caisse ou frigo scannés en une photo et recettes avec ce qui reste. Open source, licence MIT.

<p align="center">
  <img src="landing/public/screenshots/accueil.jpg" alt="Écran d’accueil" width="260" />
  <img src="landing/public/screenshots/recettes.jpg" alt="Écran Recettes" width="260" />
</p>

Deux façons de s’en servir :

- **Clé en main** — hébergé pour toi, gratuit pour l’essentiel, abonnement pour l’IA.
- **Auto-hébergé** — l’API tourne chez toi, l’app ne parle qu’à ton serveur. C’est ce que décrit la suite.

## Installation

Il faut une machine avec Docker (Compose v2), sur le même réseau que les téléphones. Compte quelques centaines de Mo de RAM (~2 Go de plus avec la supervision).

### 1. Créer le fichier compose et le `.env`

Les images sont construites par la CI et publiées sur GHCR : ni clone, ni build. Enregistre ceci sous `docker-compose.yml` sur ton serveur. Il ne contient aucun secret : ils vivent dans le `.env` à côté.

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
    # Fige une version de la page Releases (ex. 1.0.0) dès qu’il y en a une ; main suit le développement
    image: ghcr.io/floriaaan/garde-manger-backend:${GARDE_MANGER_VERSION:-main}
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - '3333:3333'
    volumes:
      - storage:/app/data
    # Permet à OLLAMA_BASE_URL d’atteindre un Ollama installé sur l’hôte (Linux compris).
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

Crée ensuite le `.env` à côté. Remplace `192.168.1.42` par l’adresse du serveur vue par les téléphones (IP locale ou domaine, jamais `localhost`) ; les secrets sont générés pour toi :

```bash
IP=192.168.1.42
# IP du serveur : ipconfig getifaddr en0 (macOS) · hostname -I | awk '{print $1}' (Linux)
cat > .env <<EOF
GARDE_MANGER_VERSION=main
DB_PASSWORD=$(openssl rand -hex 24)
APP_KEY=$(openssl rand -base64 32)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
APP_URL=http://$IP:3333
NETWORK_URL=http://$IP:3333
# exp:// = Expo Go, gardemanger:// = l’app installée
CORS_ORIGIN=exp://,gardemanger://
# IA : scan de tickets et du frigo + recettes. Renseigne au moins un fournisseur (voir Configuration).
AI_PROVIDER=gemini
GEMINI_API_KEY=
EOF
chmod 600 .env
```

- `APP_URL` et `NETWORK_URL` : l’adresse du serveur vue par les téléphones, pas `localhost`.
- Au moins un fournisseur IA, sinon les scans et les recettes restent désactivés. Le reste a des valeurs par défaut raisonnables : la liste complète est dans [`.env.example`](.env.example).
- Le `.env` contient tes secrets : ne le versionne pas et ne le colle nulle part (`chmod 600 .env`).

### 2. Démarrer

```bash
docker compose up -d
```

Les migrations de la base s’exécutent automatiquement au démarrage. Vérifie :

```bash
curl http://localhost:3333/health
# {"status":"ok"}
```

Ça démarre Postgres et l’API en HTTP simple, sur ton réseau local uniquement. Pour l’exposer ou protéger les sessions, voir [HTTPS](#https). Sans supervision (voir [Supervision](#supervision)).

### 3. Installer l’app sur ton téléphone

**Android** : télécharge le dernier `.apk` sur la page [Releases](https://github.com/floriaaan/garde-manger/releases/latest) et ouvre-le (Android te demandera d’autoriser les installations depuis cette source). Au premier lancement, choisis **Auto-hébergé** et saisis l’adresse de ton serveur (`http://192.168.1.42:3333`, pas `localhost`). Crée ensuite un compte, puis un foyer. Les autres membres créent leur propre compte et rejoignent le foyer avec son code d’invitation.

**iOS** : l’app n’est pas encore sur l’App Store ni sur TestFlight. En attendant, passe par Expo Go ci-dessous.

<details>
<summary>Expo Go (iOS, ou pour développer)</summary>

Solution provisoire : elle tourne dans [Expo Go](https://expo.dev/go) depuis un ordinateur du même réseau avec `git` et Node.js 24+ :

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

Scanne le QR code avec l’appareil photo (iOS) ou Expo Go (Android).

> Si la connexion échoue avec une erreur d’origine, vérifie que `CORS_ORIGIN` dans ton `.env` contient bien `exp://` (Expo Go).

</details>

## Configuration

Tout se règle dans le `.env` à côté du compose (la liste complète est dans [`.env.example`](.env.example)), puis `docker compose up -d` pour appliquer.

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

Désactivée dans le compose ci-dessus (`OTEL_ENABLED` et `TELEMETRY_INGEST_ENABLED` non définis). Pour l’activer (OpenTelemetry Collector + OpenObserve), utilise plutôt le [`compose.yml`](compose.yml) du dépôt avec son [`.env.example`](.env.example). Change `OPENOBSERVE_ROOT_EMAIL`, `OPENOBSERVE_ROOT_PASSWORD` et `OTLP_STORE_AUTH` ensemble avant d’exposer quoi que ce soit. Détails dans [docs/observabilite.md](docs/observabilite.md).

### HTTPS

Le compose ci-dessus sert du HTTP simple : correct sur un réseau domestique de confiance, mais les sessions circulent en clair. Pour l’exposer ou les protéger, place un reverse proxy devant. Avec [Caddy](https://caddyserver.com) (certificats automatiques, il faut un domaine qui pointe vers le serveur) :

```yaml
  # à ajouter dans docker-compose.yml, et retirer `ports:` du backend
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

Ajoute `caddy_data:` au bloc `volumes:`, puis mets `APP_URL` et `NETWORK_URL` à `https://garde-manger.example.com` dans le `.env`, et `EXPO_PUBLIC_API_URL` dans l’app.

## Au quotidien

```bash
docker compose logs -f backend             # journaux de l’API
docker compose down                        # arrêter (les données restent)
```

Les données vivent dans deux volumes Docker : `pgdata` (la base) et `storage` (photos des tickets et produits).

### Mettre à jour

Les migrations s’exécutent automatiquement et ne se défont pas : sauvegarde d’abord, puis passe à une version taguée listée dans le [changelog](CHANGELOG.md) (page [Releases](https://github.com/floriaaan/garde-manger/releases)) :

```bash
docker compose exec -T db pg_dump -U garde_manger garde_manger > garde-manger-$(date +%F).sql
# mets GARDE_MANGER_VERSION=X.Y.Z dans .env, puis :
docker compose pull && docker compose up -d
```

Revenir en arrière, c’est restaurer ce dump sur la version précédente : garde le fichier tant que tout n’est pas validé. Sauvegarde aussi le volume `storage` si tu tiens aux photos.

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
