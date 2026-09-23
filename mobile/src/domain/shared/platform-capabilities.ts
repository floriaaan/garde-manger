/**
 * What this build may offer, given the store it ships through (ADR 0019).
 *
 * The App Store forbids steering to an outside payment for digital goods
 * (guideline 3.1.1): until an in-app purchase exists, iOS never shows the
 * Stripe subscription. Android and web are unchanged.
 */
export interface PlatformCapabilities {
  /** The Stripe subscription: paywalls, prices, Checkout, Customer Portal. */
  billing: boolean
}

export function capabilitiesFor(os: string): PlatformCapabilities {
  const appStore = os === 'ios'
  return { billing: !appStore }
}
