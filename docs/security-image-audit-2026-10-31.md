# Audit des images Docker — 30–31 octobre 2026

## Méthode

Scan Trivy **0.76.1**, exécuté dans Docker, sans installation de CLI sur l’hôte.
Scanner épinglé sur `aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c`.
Analyse des paquets système et des dépendances applicatives détectables dans les
images, avec `--scanners vuln`, sans masquer les vulnérabilités non corrigées.
[Documentation Trivy](https://trivy.dev/docs/latest/guide/target/container_image/).

Images du registre : **linux/amd64**, comme les images applicatives publiées.
Images locales et couches corrigées construites pour le diagnostic : **linux/arm64**.
Les comptes sont des occurrences paquet/avis et ne doivent pas être additionnés
pour obtenir un nombre de CVE distinctes. Le scan ne prouve pas l’exploitabilité.

**Limite :** la base Java n’a pas pu être extraite (« no space left on device »).
Les analyses applicatives excluent donc `**/*.jar`, `**/*.war`, `**/*.ear` et
`**/*.aar`. Les paquets OS, npm, Go et les autres formats détectés restent analysés.
Les premiers téléchargements GHCR ont également échoué (HTTP/2, EOF) ; une reprise
avec HTTP/2 désactivé et une seule couche analysée à la fois a réussi pour les
trois images publiées. Le diagnostic ne couvre pas les secrets ni les configurations.

## Résultats mesurés

`backend-no-java`, `landing-no-java` et `expo-web` désignent les images GHCR `:main`.
Les lignes `*-runtime` et `nginx-candidate` désignent seulement les couches de base
corrigées, sans les fichiers applicatifs. `otel-candidate` est l’image complète
Collector 0.164.0. Les autres lignes sont les tags utilisés avant les corrections.

| Image | Critique | Élevée | Modérée | Faible | Inconnue | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `backend-no-java` | 5 | 35 | 47 | 9 | 0 | 96 |
| `landing-no-java` | 2 | 25 | 34 | 5 | 0 | 66 |
| `expo-web` | 1 | 2 | 2 | 44 | 0 | 49 |
| `node24` | 0 | 6 | 10 | 1 | 0 | 17 |
| `node26` | 0 | 6 | 10 | 1 | 0 | 17 |
| `nginx` | 1 | 2 | 2 | 44 | 0 | 49 |
| `postgres` | 1 | 25 | 31 | 3 | 1 | 61 |
| `otel` | 3 | 13 | 19 | 1 | 3 | 39 |
| `openobserve` | 0 | 2 | 38 | 16 | 0 | 56 |
| `node24-runtime` | 0 | 0 | 0 | 0 | 0 | 0 |
| `node26-runtime` | 0 | 0 | 0 | 0 | 0 | 0 |
| `nginx-candidate` | 0 | 0 | 0 | 0 | 0 | 0 |
| `otel-candidate` | 0 | 1 | 0 | 0 | 3 | 4 |

## Correctifs dans le dépôt

- `compose.yml` : Collector **0.160.0 → 0.164.0**, soit **39 → 4 alertes**,
  critiques **3 → 0**. La commande `validate` de la nouvelle image accepte
  `observability/otel-collector.yaml` avec des valeurs d’environnement de diagnostic.
  [Release](https://github.com/open-telemetry/opentelemetry-collector-releases/releases/tag/v0.164.0).
- `mobile/Dockerfile.web` : `apk upgrade --no-cache` dans la couche nginx.
  Met à jour Brotli 1.2.0-r1 → 1.2.1-r0 et curl/libcurl 8.22.0-r0 → 8.23.0-r0.
  Couche corrigée : **49 → 0 alertes**, dont l’alerte critique Brotli
  `CVE-2026-111497`. La configuration nginx du projet est vérifiée avec `nginx -t`.
- `backend/Dockerfile` et `landing/Dockerfile` : les étapes de production partent
  directement de Node Alpine et suppriment npm. Corepack/pnpm restent dans les
  étapes de build. Les couches de production isolées corrigées remontent **0 alerte**.
  Les couches Node brutes remontaient 17 alertes dans npm ; hériter de l’étape
  `base` ajoutait aussi les dépendances vulnérables de pnpm 11.17.0.
- La landing appelle directement `node node_modules/srvx/bin/srvx.mjs` avec les
  mêmes arguments que son script `start`. Le chemin du binaire srvx 1.0.5 a été
  vérifié et sa commande `--help` fonctionne dans la couche Node 26 sans npm/pnpm.

Les cinq occurrences critiques du backend publié (Better Auth, TanStack Start,
proxy-addr, shell-quote) et les deux de la landing (TanStack Start) correspondent
aux versions corrigées dans le lockfile lors de l’audit npm précédent.

**Ces modifications ne changent pas les images déjà publiées ou les conteneurs en
cours.** Les images complètes du projet n’ont pas été reconstruites. La validation des correctifs retenus a porté sur trois petites couches
isolées, sans build applicatif complet.
Un rebuild avec les bases fraîches, puis un scan des images finales, reste nécessaire
avant de conclure sur les totaux après correction de chaque application complète.
Les suites de tests, builds applicatifs, lint et typechecks n’ont pas été lancés.

## Alertes non corrigées automatiquement

- **PostgreSQL 16 Alpine actuel : 61 alertes**, dont 1 critique et 25 élevées,
  toutes dans `/usr/local/bin/gosu`, compilé avec Go 1.24.6. L’OS de l’image du
  registre est déjà corrigé. Les versions corrigées indiquées sont celles de Go,
  pas une version d’image PostgreSQL garantissant la résolution. Attendre une
  reconstruction amont de gosu ou évaluer une image dérivée ; pas de changement
  majeur de PostgreSQL ni de migration du volume pour cet audit.
- **OpenObserve 0.92.2 : 56 alertes**, dont 2 élevées dans `libssl3t64`
  (3.5.6-1~deb13u2 ; correctifs 3.5.7-1~deb13u2/u3). Le tag ne s’est pas rafraîchi.
  Pas de release corrective 0.92.x plus récente trouvée : la version stable
  suivante disponible est dans la branche **1.x** (dernière 1.1.2). Migration à
  préparer avec sauvegarde et validation, pas de remplacement automatique.
- **Collector 0.164.0 : 1 élevée et 3 de sévérité inconnue**. L’élevée concerne
  `github.com/go-jose/go-jose/v4` 4.1.5, corrigée en 4.1.6 (`CVE-2026-116587`).
  Les autres concernent x/crypto et x/net. Les composants effectivement configurés
  sont moins nombreux que ceux embarqués dans l’image contrib ; l’exposition de
  chaque dépendance n’a pas été démontrée. Attendre une release amont corrigée.
- Les outils de **build** npm/pnpm gardent des alertes dans les étapes de build ;
  ils sont exclus des étapes de production, sans migration du gestionnaire de
  paquets imposée au projet.

Le PostgreSQL local ancien remontait 91 alertes contre 61 pour le tag frais.
Le backend local du 7 septembre remontait 100 alertes et ne représente pas le
backend GHCR actuel. Aucun service existant n’a été redémarré ou remplacé.

## Digests analysés

- `backend-no-java` : `ghcr.io/floriaaan/garde-manger-backend@sha256:caa9459f4a7b0534ac52b9b04e04ead8809d264694519e0170085c2e00d70c40`.
- `landing-no-java` : `ghcr.io/floriaaan/garde-manger-landing@sha256:2b1b4492d9e5541ceb6f3837e0868b262b22a9a93414efbb7b2dfb25962fc820`.
- `expo-web` : `ghcr.io/floriaaan/garde-manger-expo-web@sha256:b360611b5c623f1df1312fffb7300f59510664011250214628df23be0aa563b5`.
- `node24` : `node@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85`.
- `node26` : `node@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94`.
- `nginx` : `nginx@sha256:0e52bd054126cdc040b1276c0af347aeb02a41b9cfe305d6094767ac30e97949`.
- `postgres` : `postgres@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab`.
- `otel` : `otel/opentelemetry-collector-contrib@sha256:799dc6cf12c96192af37b5bdba804da8c10b3bc563b43cb90c3f3c58d9572ad6`.
- `openobserve` : `openobserve/openobserve@sha256:88fb692ac791d3eaff69653a4a4686f1c7eceb9e105491d58d29ac2739560b3b`.
- `otel-candidate` : `otel/opentelemetry-collector-contrib@sha256:340c9ca6a36617084c6661bdc4f0fe92b7cda5a805d61673ec8db375fddc522b`.
- `local-postgres` : `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- `local-otel` : `otel/opentelemetry-collector-contrib@sha256:799dc6cf12c96192af37b5bdba804da8c10b3bc563b43cb90c3f3c58d9572ad6`.
- `local-openobserve` : `openobserve/openobserve@sha256:88fb692ac791d3eaff69653a4a4686f1c7eceb9e105491d58d29ac2739560b3b`.

## Reproduction

```sh
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v trivy-cache:/root/.cache \
  aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c \
  image --scanners vuln --format json postgres:16-alpine
```

Pour cibler le registre plutôt que le cache Docker, ajouter `--image-src remote
--platform linux/amd64`. Pour reproduire le périmètre sans Java, ajouter
`--skip-files '**/*.jar,**/*.war,**/*.ear,**/*.aar'` ; sans cette option, prévoir
suffisamment d’espace disque pour la base Java.
