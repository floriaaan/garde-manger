import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  // Secrets-at-rest encryption key (Home Assistant token, cf. docs/adr/0012)
  // — deliberately not APP_KEY, which also signs sessions/cookies. 32 bytes,
  // base64-encoded (`openssl rand -base64 32`).
  ENCRYPTION_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  // HOST is 0.0.0.0 so the server answers on the LAN, which makes APP_URL
  // unusable as an outward-facing address: better-auth hands its baseURL to
  // PocketID as the OAuth redirect_uri, and the phone has to reach it too.
  // NETWORK_URL is that same server under the machine's LAN IP.
  NETWORK_URL: Env.schema.string({ format: 'url', tld: false }),

  // better-auth session/cookie signing key — cf. instance.ts.
  BETTER_AUTH_SECRET: Env.schema.secret(),

  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  // PocketID (OIDC) — cf. docs/adr/0005.
  POCKETID_ISSUER_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  POCKETID_CLIENT_ID: Env.schema.string.optional(),
  POCKETID_CLIENT_SECRET: Env.schema.string.optional(),

  // Google OAuth (Google Cloud Console credentials) — same on/off-by-presence
  // pattern as PocketID above.
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),

  // Sign in with Apple (docs/adr/0020) — off until the four are set. The
  // "client secret" Apple wants isn't a static value: it's a short-lived JWT
  // signed with APPLE_PRIVATE_KEY, built at startup (cf. instance.ts).
  APPLE_CLIENT_ID: Env.schema.string.optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: Env.schema.string.optional(),
  APPLE_TEAM_ID: Env.schema.string.optional(),
  APPLE_KEY_ID: Env.schema.string.optional(),
  APPLE_PRIVATE_KEY: Env.schema.string.optional(),

  DISABLE_PASSWORD_LOGIN: Env.schema.boolean.optional(),

  // Frontend/app origin(s) the client actually calls the API from — used by
  // better-auth's trustedOrigins check (cf. instance.ts), comma-separated.
  CORS_ORIGIN: Env.schema.string.optional(),

  // AI providers (settings, cf. docs/adr/0007) — comma-separated whitelist of
  // what this instance exposes, in order; the first entry is the default a
  // household gets before anyone picks. Unset means "all of them". Validated
  // by `parseAllowedProviders`, not by the schema, so the error names the
  // offending value.
  AI_PROVIDER: Env.schema.string.optional(),
  GEMINI_API_KEY: Env.schema.string.optional(),
  OPENAI_API_KEY: Env.schema.string.optional(),
  OLLAMA_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  OLLAMA_VISION_MODEL: Env.schema.string.optional(),
  OLLAMA_TEXT_MODEL: Env.schema.string.optional(),

  // Official SaaS instance only (`INSTANCE_MODE=hosted`): monthly AI call
  // quota per household, free vs. subscriber (cf. docs/adr/0014). Ignored on
  // self-hosted instances, which are never capped.
  AI_QUOTA_FREE: Env.schema.number.optional(),
  AI_QUOTA_SUBSCRIBED: Env.schema.number.optional(),
  // Comma-separated household ids never capped on the hosted instance — the
  // App Store review account (`node ace seed:review-account` prints its id).
  AI_QUOTA_EXEMPT_HOUSEHOLD_IDS: Env.schema.string.optional(),

  // App Store review account, created by `node ace seed:review-account`.
  REVIEW_ACCOUNT_EMAIL: Env.schema.string.optional(),
  REVIEW_ACCOUNT_PASSWORD: Env.schema.string.optional(),

  // Stripe billing for the hosted subscription (docs/adr/0015). The webhook
  // secret (`whsec_…`) verifies `POST /api/webhooks/stripe`; unset on a hosted
  // instance means that route refuses every request. `STRIPE_RETURN_URL` is
  // where Checkout / the billing portal send the user back to (defaults to
  // `APP_URL` + `/api/settings/subscription/return`, which bounces into the app).
  STRIPE_SECRET_KEY: Env.schema.string.optional(),
  STRIPE_WEBHOOK_SECRET: Env.schema.string.optional(),
  STRIPE_PRICE_ID: Env.schema.string.optional(),
  STRIPE_RETURN_URL: Env.schema.string.optional({ format: 'url', tld: false }),

  // Root directory for locally-stored images (receipts, products) — cf. ADR-0009.
  STORAGE_ROOT: Env.schema.string.optional(),

  // Observability — cf. docs/adr/0011. `OTEL_ENABLED` and the OTEL_* exporter
  // variables are read straight from `process.env` by `instrumentation.ts`,
  // which runs before this file exists; they are declared here only so that
  // a typo surfaces at boot instead of as silent missing telemetry.
  OTEL_ENABLED: Env.schema.boolean.optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: Env.schema.string.optional({ format: 'url', tld: false }),
  APP_VERSION: Env.schema.string.optional(),
  DEPLOY_ENV: Env.schema.string.optional(),

  // Mobile telemetry relay (POST /api/telemetry/v1/*) — the app never talks
  // to the collector directly, cf. docs/adr/0011.
  TELEMETRY_INGEST_ENABLED: Env.schema.boolean.optional(),

  // Async AI tasks (cf. docs/adr/0016)
  JOB_WORKER_ENABLED: Env.schema.boolean.optional(),
  JOB_MAX_CONCURRENCY: Env.schema.number.optional(),
  JOB_UNIT_TIMEOUT_MS: Env.schema.number.optional(),
  SCAN_DRAFT_TTL_HOURS: Env.schema.number.optional(),
  // Push notifications (cf. docs/adr/0018). Digest = one daily "expiring soon" push.
  PUSH_ENABLED: Env.schema.boolean.optional(),
  PUSH_DIGEST_HOUR: Env.schema.number.optional(),
  PUSH_TIMEZONE: Env.schema.string.optional(),
  EXPO_ACCESS_TOKEN: Env.schema.string.optional(),
  TELEMETRY_OTLP_ENDPOINT: Env.schema.string.optional({ format: 'url', tld: false }),
  TELEMETRY_MAX_BODY_BYTES: Env.schema.number.optional(),
  TELEMETRY_RATE_LIMIT_PER_MINUTE: Env.schema.number.optional(),

  // Home Assistant SSRF allowlist (cf. docs/adr/0013) — comma-separated
  // `host` or `host:port`. Empty/unset = allow all (the default: HA is
  // almost always on a private LAN address, which the usual "block private
  // ranges" SSRF mitigation would itself block).
  HOME_ASSISTANT_ALLOWED_HOSTS: Env.schema.string.optional(),

  // GET /api/public/stats (instance-wide counts for the landing page).
  // Off by default: on a one-household instance even aggregates describe
  // that household.
  PUBLIC_STATS_ENABLED: Env.schema.boolean.optional(),

  // GET /api/public/instance — lets the mobile app tell a self-hosted
  // backend apart from the (not yet open) hosted offering, cf. onboarding.
  INSTANCE_MODE: Env.schema.enum.optional(['hosted', 'self-hosted'] as const),
  INSTANCE_NAME: Env.schema.string.optional(),
})
