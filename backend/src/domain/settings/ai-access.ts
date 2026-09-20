/**
 * What a household may currently do with the AI features — never persisted,
 * folded into `EffectiveAiSettings` by `AiSettingsProvider.resolveEffective()`.
 *
 * Self-hosted instances are always `self-hosted`: no quota, no paywall, the
 * operator pays their own API bills. The hosted instance starts every foyer
 * on `free` and moves it to `subscriber` once `SubscriptionPort` says so.
 */
export interface AiAccess {
  plan: 'self-hosted' | 'free' | 'subscriber'
  /** Calls used this calendar month. `0` on self-hosted (never read). */
  used: number
  /** `null` on self-hosted — usage is never capped. */
  limit: number | null
  /** Start of next month (UTC) — `null` on self-hosted. */
  resetsAt: Date | null
  /** Set only for `plan: 'subscriber'`. */
  expiresAt: Date | null
  /** Set only for `plan: 'subscriber'`: cancelled, access runs until `expiresAt`. */
  cancelsAtPeriodEnd: boolean
}
