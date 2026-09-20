export interface HouseholdSubscription {
  payerUserId: string | null
  /** `null` on a row that predates Stripe (docs/adr/0015). */
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  expiresAt: Date
  /** Cancelled in Stripe, access runs until `expiresAt`. */
  cancelAtPeriodEnd: boolean
}

export interface SubscriptionUpsert {
  householdId: string
  payerUserId: string | null
  stripeCustomerId: string
  stripeSubscriptionId: string
  expiresAt: Date
  cancelAtPeriodEnd: boolean
}

export interface SubscriptionPort {
  /**
   * Is this household entitled to the AI features right now? Always `true`
   * on a self-hosted instance. `null` — a user with no household yet — is
   * never entitled.
   */
  hasActiveSubscription(householdId: string | null): Promise<boolean>

  /** Current entitlement row, if any — `null` when never subscribed. */
  find(householdId: string): Promise<HouseholdSubscription | null>

  /**
   * Upserts the household's entitlement from a Stripe subscription event —
   * always sets `expiresAt` to the value the event implies, never merges
   * with what was there (cf. `HandleStripeWebhook`).
   */
  upsert(params: SubscriptionUpsert): Promise<void>

  /**
   * Cuts the household's entitlement short (`expiresAt = now`) for every
   * subscription this user pays for, and returns those Stripe subscription
   * ids so the caller can stop the billing too (cf. `RevokePayerSubscriptions`).
   * Called when a payer leaves or is removed from their foyer — the foyer
   * they paid for loses access immediately. Empty if the user never paid.
   */
  revokeForPayer(userId: string, now: Date): Promise<string[]>
}
