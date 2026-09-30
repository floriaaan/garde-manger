# garde-manger mobile

Expo (SDK 57) app for garde-manger, built with expo-router and TanStack Query.

## Setup

This app lives in a pnpm workspace — install from the repo root, not from `mobile/`:

```bash
pnpm install
# or
task setup
```

## Environment

Copy `mobile/.env.example` to `mobile/.env` and adjust as needed:

- `EXPO_PUBLIC_CONNECTOR` — `http` to talk to the real backend, or `fake` to use the in-memory fake connector (no backend required).
- `EXPO_PUBLIC_API_URL` — base URL of the backend API (used when `EXPO_PUBLIC_CONNECTOR=http`).

## Expiry reminders

In **Réglages → Rappels de péremption**, a household member chooses 0, 1, 2, 3 or 7 days (2 by default). Each member enables notifications on each desired device. The server sends one summary per device each day at 09:00 Europe/Paris by default; instance operators can change the hour and timezone with `PUSH_DIGEST_HOUR` and `PUSH_TIMEZONE`.

Native push needs an installed development/store build with Expo push credentials. Web push needs HTTPS, a service worker, and the backend's stable `WEB_PUSH_VAPID_*` settings. On iPhone/iPad, add the web app to the home screen before enabling notifications. The backend's `.env.example` describes the VAPID setup.

## Running

```bash
task mobile:dev
# or, from mobile/
pnpm run start
```

## Project layout

Code lives under `mobile/src`, layered as `domain/`, `application/`, `infrastructure/`, `presentation/`. `src/app/` is routing only (expo-router file-based routes) — it wires screens together but never imports `infrastructure/` directly; screens depend on `application/`/`presentation/` instead.

## Checks

From `mobile/`:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run boundaries
```

Or from the repo root: `task mobile:lint`, `task mobile:typecheck`, `task mobile:test`, `task mobile:boundaries` (or `task check` for the whole repo).
