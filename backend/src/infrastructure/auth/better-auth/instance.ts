import { betterAuth, APIError } from 'better-auth'
import { genericOAuth } from 'better-auth/plugins'
import { expo } from '@better-auth/expo'
import { passkey } from '@better-auth/passkey'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import env from '#start/env'

const pool = new Pool({
  host: env.get('DB_HOST'),
  port: env.get('DB_PORT'),
  user: env.get('DB_USER'),
  password: env.get('DB_PASSWORD'),
  database: env.get('DB_DATABASE'),
})

const db = new Kysely({ dialect: new PostgresDialect({ pool }) })

const pocketIdClientId = env.get('POCKETID_CLIENT_ID', '')
const pocketIdClientSecret = env.get('POCKETID_CLIENT_SECRET', '')
const pocketIdIssuerUrl = env.get('POCKETID_ISSUER_URL', '')
const pocketIdConfigured = Boolean(pocketIdClientId && pocketIdClientSecret && pocketIdIssuerUrl)

const googleClientId = env.get('GOOGLE_CLIENT_ID', '')
const googleClientSecret = env.get('GOOGLE_CLIENT_SECRET', '')
const googleConfigured = Boolean(googleClientId && googleClientSecret)

// WebAuthn binds a passkey to a single origin/hostname (`rpID`) for its
// lifetime — NETWORK_URL is that same "however this backend is actually
// reached" address already used as the PocketID redirect_uri, so passkeys
// keep working across the LAN-IP-in-dev / real-domain-in-prod split without
// their own env var.
const networkUrl = new URL(env.get('NETWORK_URL'))

/**
 * Unlike arr's OIDC config (hot-reloaded from a settings table), PocketID
 * here is static from env for the whole process lifetime — only the AI
 * provider hot-reloads (cf. docs/adr/0005, docs/adr/0007). One instance,
 * built once at module load.
 */
export const auth = betterAuth({
  database: { db, type: 'postgres' },
  secret: env.get('BETTER_AUTH_SECRET').release(),
  baseURL: env.get('NETWORK_URL'),
  trustedOrigins: env
    .get('CORS_ORIGIN', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  emailAndPassword: { enabled: !env.get('DISABLE_PASSWORD_LOGIN', false) },
  /**
   * The migration (`create_identity_tables_table.ts`) uses snake_case
   * columns, matching every other table in this codebase — better-auth's
   * Kysely adapter otherwise queries columns by its own camelCase field
   * names verbatim (no automatic case translation), so every multi-word
   * field needs an explicit mapping here.
   */
  user: {
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    deleteUser: {
      enabled: true,
      /**
       * Safety net for the client-side flow (which offers ownership
       * transfer before deletion): solo owner's household is deleted
       * outright, plain member just leaves, owner-with-others is blocked
       * since they must transfer ownership first (cf. household.aggregate's
       * `transferOwnership`).
       */
      beforeDelete: async (user) => {
        const appModule = await import('@adonisjs/core/services/app')
        const app = appModule.default
        const households = await app.container.make('identity.households')
        const household = await households.findByUserId(user.id)
        if (!household) return

        if (household.ownerId === user.id) {
          if (household.members.length > 1) {
            throw new APIError('BAD_REQUEST', {
              message: 'Transférez la propriété du foyer avant de supprimer votre compte.',
              code: 'ownership_transfer_required',
            })
          }
          await households.delete(household.id)
          return
        }

        const { LeaveHousehold } = await import('#application/identity/leave-household.use-case')
        await new LeaveHousehold(households).execute({ userId: user.id })

        // Cf. `household.controller.ts`'s `leave`/`removeMember` — deleting
        // the account is one more way to stop being in the foyer you paid
        // for.
        const { RevokePayerSubscriptions } =
          await import('#application/settings/revoke-payer-subscriptions.use-case')
        await new RevokePayerSubscriptions(
          await app.container.make('settings.subscriptions'),
          await app.container.make('settings.billing'),
          await app.container.make('shared.clock'),
        ).execute({ userId: user.id })
      },
    },
  },
  session: {
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  account: {
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    /**
     * `trustedProviders`/`requireLocalEmailVerified` stay at better-auth's
     * safe defaults (empty / true) on purpose: this app has no email
     * verification, so trusting them would auto-merge an OAuth sign-in onto
     * *any* pre-existing unverified password account with a matching email —
     * account takeover with no proof of ownership. Defaults only block that
     * *implicit* merge during a fresh sign-in; explicit linking (the
     * authenticated `authClient.linkSocial()` call from the account screen)
     * bypasses both checks entirely, since the caller already holds a valid
     * session for the account being linked.
     */
    accountLinking: {
      enabled: true,
    },
  },
  ...(googleConfigured
    ? {
        socialProviders: { google: { clientId: googleClientId, clientSecret: googleClientSecret } },
      }
    : {}),
  verification: {
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  plugins: [
    expo(),
    passkey({
      rpID: networkUrl.hostname,
      rpName: env.get('INSTANCE_NAME', 'Garde-manger'),
      origin: env.get('NETWORK_URL'),
      schema: {
        passkey: {
          fields: {
            publicKey: 'public_key',
            userId: 'user_id',
            credentialID: 'credential_id',
            deviceType: 'device_type',
            backedUp: 'backed_up',
            createdAt: 'created_at',
          },
        },
      },
    }),
    ...(pocketIdConfigured
      ? [
          genericOAuth({
            config: [
              {
                providerId: 'pocketid',
                clientId: pocketIdClientId,
                clientSecret: pocketIdClientSecret,
                discoveryUrl: `${pocketIdIssuerUrl}/.well-known/openid-configuration`,
                // Without this, better-auth defaults to `scopes: []` — an
                // empty `scope=` param that PocketID rejects outright with
                // access_denied rather than a scope-specific error.
                scopes: ['openid', 'profile', 'email'],
              },
            ],
          }),
        ]
      : []),
  ],
})

export type Auth = typeof auth
