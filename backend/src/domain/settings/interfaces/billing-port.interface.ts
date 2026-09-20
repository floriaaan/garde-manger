/**
 * Stripe, as far as the domain is concerned: hosted pages the mobile app
 * opens in a browser (docs/adr/0015). No card data ever transits this backend.
 */
export interface BillingPort {
  /** Stripe Checkout URL for the AI plan. `customerId` reuses the household's existing Stripe customer, if any. */
  createCheckoutUrl(params: {
    householdId: string
    payerUserId: string
    customerId: string | null
  }): Promise<string>

  /** Stripe Customer Portal URL — update card, cancel, download invoices. */
  createPortalUrl(customerId: string): Promise<string>

  /** Stops a subscription immediately. Never throws: a failed cancel must not block a member leaving. */
  cancelSubscription(subscriptionId: string): Promise<void>
}
