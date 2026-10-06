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

## Native releases and EAS Update (OTA)

### Configuration and initial activation

Expo SDK 57 / React Native 0.86.3 uses `expo-updates` ~57.0.24. The existing EAS project is
`floriaaan/garde-manger` (`67dc1735-bcfd-4ccc-a8af-a84df72877b2`). `app.json` points to its update URL.
The `preview` build profile uses channel `staging`, environment `preview` and internal distribution (Android APK);
`production` uses channel `main`, environment `production` and store distribution. `development` remains an
internal development client without an automatic OTA channel. No CI publication behavior was changed.

Audit on 2026-10-06: no remote channels, branches or EAS variables existed in preview/production.
The last production iOS/Android builds (2026-10-03, version 1.0.0, build numbers 3/4) had no OTA channel
or runtime. **Build and distribute a new binary once to activate EAS Update.** An OTA cannot install
the native update module into existing binaries. The app version stays 1.0.0 for this activation.
Follow-up audit on 2026-10-06: channel `staging` points to EAS branch `staging` and channel `main`
now points to EAS branch `main` (linked by the project owner). Neither branch had published updates.
Profiles/environments keep their existing names (`preview`/`production`); only channels use `staging`/`main`.
EAS branches are not Git branches. Changing the local channel affects future builds; existing binaries
retain the channel embedded at build time. The remote EAS `production` environment is still empty:
prepare its public variables below before publishing an OTA.

Prerequisites: Node 24+, installed workspace dependencies (`pnpm install --frozen-lockfile` from the root),
EAS CLI satisfying `eas.json` (audited with 24.7.0), and `eas login` or `EXPO_TOKEN`.
Only package/lockfile resolution was performed during setup; dependencies were not installed into this worktree.

### Prepare EAS environment variables before the first OTA

SDK 57 requires `eas update --environment ...`; it does not use the build profile's `env` values
automatically. Local `.env` files are ignored with this flag. Keep the remote environment aligned with
the selected profile in `eas.json`, including the connector, API URL and telemetry settings.
Preview currently uses the same production backend and telemetry environment as production; this is preserved.
`EXPO_PUBLIC_*` values are embedded in the bundle and must never contain secrets.

From `mobile/`, repeat the following with `profile=production` after `preview`. This extracts values from
`eas.json` without duplicating them in Taskfile. **These commands write remote environment configuration**;
review the push prompt and use plaintext visibility for these public values. They were not run during setup.

```bash
profile=preview
env_file=$(mktemp)
node -e 'const c=require("./eas.json"); for (const [k,v] of Object.entries(c.build[process.argv[1]].env)) console.log(`${k}=${JSON.stringify(v)}`)' "$profile" > "$env_file"
eas env:push "$profile" --path "$env_file"
rm -f "$env_file"
eas env:list "$profile"
```

`task mobile:update` first pulls the selected remote environment into a temporary file and checks its
values against the profile's `env`. Missing/mismatched values stop the task before export or publication.
The temporary file is removed. Additional remote variables also affect the bundle; review them before publishing.

### OTA or new binary?

| Change | Required workflow |
| --- | --- |
| Compatible JS/TS logic, screens, styling, translations, pure JS dependencies | OTA |
| Images/fonts/assets loaded by JS with APIs already present in the binary | OTA |
| Add/remove/upgrade a dependency with native code, Expo SDK or React Native | New runtime version + build + distribution |
| Expo config plugins/options, permissions, entitlements, associated domains, schemes | New runtime version + build + distribution |
| Changes to `ios/` or `android/`, native extensions (including share intent), native build settings | New runtime version + build + distribution |
| App icon, native splash screen, bundled native fonts, update URL/channel/native update settings | New runtime version + build + distribution |

OTA must continue working with the native modules **already installed** and with persisted user data/API
contracts. A dependency is OTA-safe only if its change does not affect native code/configuration. If uncertain,
use a new binary. Web deployment remains separate from native EAS Update.

`runtimeVersion.policy = "appVersion"` derives the runtime from **`expo.version` in app.json**, currently
`1.0.0`, for both platforms. Devices only load updates matching their runtime and platform via their channel's
linked branch. EAS branches are distinct from Git branches; a channel may be remapped to another EAS branch.

**Before any incompatible native change, increase `expo.version` (for example to 1.1.0), then build/distribute
new preview and production binaries.** Retain that version for compatible OTAs. `autoIncrement: true` and
`appVersionSource: remote` manage store build numbers/version codes; incrementing those numbers alone does
**not** change the `appVersion` runtime. This policy depends on that version discipline; it does not inspect
native changes automatically. Do not publish code from a newer native runtime under an older `expo.version`.

### Publish an OTA

From the repository root, after reviewing native compatibility and preparing the remote environment:

```bash
task mobile:update CHANNEL=staging MESSAGE="Fix session persistence"
# Test on an installed preview binary with the matching runtime before production:
task mobile:update MESSAGE="Fix session persistence"
```

The default channel is the production profile's channel (`main`); OTA targets iOS and Android without
platform/profile parameters. `MESSAGE` is required. Production asks you to type `production` interactively;
use `CONFIRM=production` for explicitly confirmed unattended execution. `CHANNEL=staging` remains available.
Messages are passed as process arguments, so quotes and shell characters are preserved safely.
The helper resolves channel/environment from `eas.json`; it never copies API settings into Taskfile.
The equivalent direct EAS commands, from `mobile/`, are:

```bash
eas update --channel staging --environment preview --message "Fix session persistence"
eas update --channel main --environment production --message "Fix session persistence"
```

Direct commands bypass the Task guards. By default updates download on launch and apply on a subsequent
restart: fully close/reopen the installed app twice to test. Expo Go and Metro development sessions are not
proof that store OTA delivery works. No custom reload UI or forced restart is added.

### Build and distribute a new binary

```bash
# Default: production, both platforms. Confirm interactively.
task mobile:build-publish
# Explicit confirmation for unattended use:
task mobile:build-publish CONFIRM=production
# Optional overrides:
task mobile:build-publish PROFILE=preview
task mobile:build-publish PLATFORM=ios
```

Defaults are `PROFILE=production`, `PLATFORM=all`, `SUBMIT=auto`. The task runs a single command,
`eas build --profile production --platform all --auto-submit-with-profile production`. It adds
`--auto-submit-with-profile <profile>` only for store platforms configured in `eas.json`:
iOS submits to App Store Connect / TestFlight; Android submits its AAB automatically to the Google Play
closed testing track `alpha`, configured in `submit.production.android`, with `releaseStatus: completed`.
The project owner confirmed the default closed testing track; `beta` is open testing, not closed testing.
The latest previous Android submission used `internal`; future task submissions use `alpha`.
No manual AAB upload is needed. Store processing/review still applies before availability to testers.
The planned command appears before the production confirmation. EAS manages the two platform builds and submissions.

`SUBMIT=auto` (the default) submits store builds and requires submit settings for every selected platform;
it fails before any build if a setting is missing. `SUBMIT=false` explicitly builds without submission.
The Google Service Account key must be stored in EAS with permission to submit this application; a successful
Android EAS submission was found during the audit. No credential file is added to the repository.
Internal profiles produce install links without store submission.
Production requires an interactive confirmation (type `production`) or `CONFIRM=production`;
non-interactive execution without that explicit value stops before any EAS command.
`PROFILE=development` is also accepted and preserves the existing development client setup.
Submitting to App Store Connect does not itself request App Store review or release the app to users.
The existing tag-triggered iOS CI still builds/submits production, now embedding the `main` OTA channel.

### Inspect delivery (read-only commands from mobile/)

```bash
eas channel:list --json --non-interactive
eas branch:list --json --non-interactive
eas channel:view staging
eas channel:view main
# See channel:view for the actual linked branch; do not assume it always has the channel's name:
eas update:list --branch <linked-branch> --json --non-interactive
eas update:list --all --json --non-interactive
eas update:view <update-group-id>
eas build:list --limit 5 --json --non-interactive
eas build:view <build-id> --json
```

Check `channel` and `runtimeVersion` on the **actual build**, rather than inferring them from today's
profile. In a release binary, `expo-updates` exposes `Updates.channel` and `Updates.runtimeVersion` for
diagnostics. Before production, verify the channel's branch mapping and compare the published update's
runtime/platform with the installed build. No updates have been published as part of this setup.

References: [SDK 57 expo-updates](https://docs.expo.dev/versions/v57.0.0/sdk/updates/),
[runtime policies](https://docs.expo.dev/eas-update/runtime-versions/),
[EAS environment usage](https://docs.expo.dev/eas/environment-variables/usage/),
[EAS CLI commands](https://docs.expo.dev/eas/cli/).
