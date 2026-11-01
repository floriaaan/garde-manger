# Audit des dépendances — 30 octobre 2026

## Méthode et périmètre

Diagnostic avec `pnpm audit --json` (pnpm **11.17.0**) dans un conteneur Docker
Node 24 Alpine. Aucun CLI installé sur l’hôte. L’analyse porte sur le lockfile
commun au backend, au mobile et à la landing, dépendances de développement et
optionnelles comprises. Les mises à jour ont été résolues dans une copie
temporaire des manifestes, avec `--lockfile-only --ignore-scripts`, puis reportées
dans le dépôt. Aucun `node_modules` du projet n’a été installé ou modifié.

Source des alertes : [registre npm via pnpm audit](https://pnpm.io/cli/audit).
Il s’agit d’alertes sur les versions résolues, sans preuve d’exploitabilité dans
l’application. Les images Docker et leurs paquets système sont traités séparément dans
[l’audit des images du 30–31 octobre](security-image-audit-2026-10-31.md).

## Résultats

| Sévérité | Avant | Après |
| --- | ---: | ---: |
| Critique | 5 | 0 |
| Élevée | 23 | 2 |
| Modérée | 28 | 2 |
| Faible | 8 | 2 |
| **Total** | **64** | **6** |

Les nombres sont les entrées package/avis retournées par pnpm : un même avis
peut concerner plusieurs paquets ou branches majeures (58 GHSA distincts avant,
6 après). Le code de sortie final de l’audit reste **1**, car des alertes restent
présentes. Aucune alerte n’a été ignorée.

## Correctifs appliqués

- Better Auth, `@better-auth/expo` et `@better-auth/passkey` : **1.7.14**.
- Nodemailer : **10.3.1**.
- TanStack React Start : **1.169.4**, avec ses dépendances serveur corrigées.
- Vite : **8.3.5** ; Vitest : **5.0.5**.
- Mises à jour transitives ciblées, notamment `proxy-addr`, `qs`, `fast-uri`,
  `@grpc/grpc-js`, `fast-copy` et `brace-expansion` 5.
- Overrides limités aux branches compatibles pour `brace-expansion` 1,
  `compression`, `js-yaml` 3, `node-forge`, `seroval`, `shell-quote`,
  `source-map-js`, `undici` 8 et `zod` 4. Ils imposent les versions corrigées
  aux consommateurs qui conservaient des résolutions vulnérables.

Les correctifs suppriment notamment les alertes critiques d’authentification
Better Auth, de XSS TanStack Start, d’usurpation d’IP `proxy-addr` et d’injection
de commandes `shell-quote`.

## Alertes restantes

| Paquet | Sévérité | Chaîne concernée et raison du report |
| --- | --- | --- |
| `zod` 3.25.76 | Élevée | `expo → @expo/cli → zod`. L’avis exige ≥4.6.6 ; Expo demande ^3.25.76. Ne pas forcer une migration majeure de Zod dans le CLI. [Avis](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| `decode-uri-component` 0.2.2 | Élevée + modérée | `expo-router → query-string`. Correctifs ≥0.5.1 et ≥0.4.3, hors de la plage ^0.2.2 attendue par query-string. Mise à jour amont ou validation de compatibilité nécessaire. [Élevée](https://github.com/advisories/GHSA-qr28-fpjm-wq7f), [modérée](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| `uuid` 3.4.0 / 7.0.3 | Modérée | `@expo/ngrok → uuid` et `@expo/config-plugins → xcode → uuid`. Correctif ≥11.1.1 : changement majeur et anciennes API à vérifier. [Avis](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
| `esbuild` 0.27.7 | Faible | Via Vite, Tamagui et esbuild-register. Correctif ≥0.28.1 hors des plages 0.27 utilisées ; concerne le serveur de développement Windows. [Avis](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) |
| `deepmerge` 4.3.1 | Faible | Via Lucid, Expo et Jest. L’avis indique ≥4.3.2, mais npm ne publie pas cette version à la date du scan (HTTP 404 ; dernière version 4.3.1). Aucun override vers une version inexistante. [Avis](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) |

Les outils Expo peuvent apparaître sous le backend dans le graphe, car
`@better-auth/expo` entraîne des dépendances peer Expo. Cela ne prouve pas
qu’une fonctionnalité vulnérable est appelée en production.

## Validation et reproduction

Le scan final a été effectué sur les manifestes et le lockfile corrigés.
`pnpm peers check` retourne les trois mêmes avertissements avant/après :
ESLint 10 avec eslint-plugin-react, les types React 19.2/19.3 et
lottie-react-native avec dotlottie-react. Aucun nouveau conflit peer détecté.
Les tests, builds, lint et typechecks n’ont pas été exécutés, conformément à
AGENTS.md. La compatibilité d’exécution reste donc à valider par la CI.

Pour relancer le diagnostic depuis la racine, sans installer de CLI sur l’hôte :

```sh
docker run --rm \
  -v "$PWD:/scan:ro" -w /scan \
  node@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 \
  npm exec --yes --package=pnpm@11.17.0 -- pnpm audit --json
```
