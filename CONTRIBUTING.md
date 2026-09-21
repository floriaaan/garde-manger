# Contributing

Thanks for wanting to help. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bug or idea**: open an [issue](https://github.com/floriaaan/garde-manger/issues) first for anything non-trivial, so we can agree on the approach before you write code.
- **Small fixes** (typos, docs, obvious bugs): a pull request is enough.
- **Security issue**: don't open a public issue. Contact the maintainer privately through GitHub.

## Setup

You need Node.js 24+, [pnpm](https://pnpm.io) (`corepack enable`), Docker, and [Task](https://taskfile.dev).

```bash
git clone https://github.com/floriaaan/garde-manger.git && cd garde-manger
task setup        # dependencies + copy the .env files
task dev          # Postgres in Docker + API locally (HMR)
task mobile:dev   # Expo dev server
task landing:dev  # marketing site, http://localhost:3000
```

Run `task --list` to see every task.

## Project layout

| Folder     | What                                     |
| ---------- | ---------------------------------------- |
| `backend/` | AdonisJS API, Postgres, better-auth      |
| `mobile/`  | Expo app (iOS / Android)                 |
| `landing/` | TanStack Start marketing site            |
| `docs/`    | Architecture decisions ([ADR](docs/adr)) |

Each package follows the same layering: `domain/`, `application/`, `infrastructure/`, `presentation/`. Dependencies only point inward, and `task <package>:boundaries` enforces it. Read the relevant [ADR](docs/adr) before changing an architectural choice; if you change one, add a new ADR rather than editing history.

## Making a change

1. Branch from `main` (`feature/…`, `fix/…`, `docs/…`).
2. Write the change **and its tests**. Follow the style of the surrounding code.
3. Run the checks for the package you touched: `task backend:check`, `task mobile:check` or `task landing:check`. `task check` runs everything, as CI does.
4. Open a pull request against `main` describing what changed and why. Keep it focused: one concern per PR.

### Commits

[Conventional Commits](https://www.conventionalcommits.org), in English, imperative mood:

```
feat(mobile): add haptic feedback to UI interactions
fix(backend): reject expired invite codes
docs: rewrite install guide
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. The scope is the package (`backend`, `mobile`, `landing`) or a feature (`billing`, `push`).

### User-facing changes

Add a line under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md). Releases are git tags named `X.Y.Z` (no `v` prefix); the CI publishes the matching Docker image.

## Database migrations

Migrations run automatically on startup and can't be undone in production. Make them additive when possible, and never edit a migration that has been released: add a new one.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
