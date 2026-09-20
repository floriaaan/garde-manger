*[English](README.md) · Français*

# Garde-manger

Le garde-manger partagé du foyer : inventaire, dates de péremption, liste de courses commune, tickets de caisse scannés en une photo et recettes avec ce qui reste. Open source, licence MIT.

Deux façons de s’en servir :

- **Clé en main** — hébergé pour toi, gratuit pour l’essentiel, abonnement pour l’IA. _Pas encore ouvert._
- **Auto-hébergé** — l’API tourne chez toi, l’app ne parle qu’à ton serveur. C’est ce que décrit la suite.

## Installation

Il faut une machine avec Docker (Compose v2) et `git`, sur le même réseau que les téléphones. Compte ~2 Go de RAM avec la supervision, quelques centaines de Mo sans.

### 1. Récupérer le code et configurer

```bash
git clone https://github.com/floriaaan/fridge-ai.git && cd fridge-ai
cp .env.example .env

# Génère les trois secrets obligatoires (APP_KEY, BETTER_AUTH_SECRET, ENCRYPTION_KEY)
for k in APP_KEY BETTER_AUTH_SECRET ENCRYPTION_KEY; do sed -i.bak "s|^$k=.*|$k=$(openssl rand -base64 32)|" .env; done; rm .env.bak
```

Puis, dans `.env`, remplace l’IP de `NETWORK_URL` par celle du serveur sur ton réseau :

```bash
ipconfig getifaddr en0          # macOS
hostname -I | awk '{print $1}'  # Linux
```

```dotenv
NETWORK_URL=http://192.168.1.42:3333
```

### 2. Démarrer

```bash
docker compose up -d
```

Le premier lancement construit l’image de l’API (1 à 2 minutes). Les migrations de la base passent toutes seules au démarrage. Vérifie :

```bash
curl http://localhost:3333/health
# {"status":"ok"}
```

Ça démarre Postgres, l’API, et la supervision (OpenTelemetry Collector + OpenObserve sur http://127.0.0.1:5080). Pour une machine modeste, sans supervision :

```bash
docker compose up -d db backend
```

### 3. Lancer l’app sur ton téléphone

L’app n’est pas encore sur les stores. En attendant, elle tourne dans [Expo Go](https://expo.dev/go) (App Store / Play Store), depuis un ordinateur du même réseau avec Node.js 24+ :

```bash
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

> Si la connexion échoue avec une erreur d’origine, vérifie que `CORS_ORIGIN` dans `.env` contient bien `exp://` (Expo Go) — c’est la valeur par défaut.

## Configuration

Tout se règle dans `.env` (commenté), puis `docker compose up -d` pour appliquer.

### IA (scan de tickets, recettes)

Sans fournisseur, tout marche sauf ces deux fonctionnalités. Renseigne au moins un fournisseur :

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

Change `OPENOBSERVE_ROOT_EMAIL`, `OPENOBSERVE_ROOT_PASSWORD` et `OTLP_STORE_AUTH` ensemble avant d’exposer quoi que ce soit. Les ports restent sur `127.0.0.1`. Détails dans [docs/observabilite.md](docs/observabilite.md).

## Au quotidien

```bash
git pull && docker compose up -d --build   # mettre à jour (migrations incluses)
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
