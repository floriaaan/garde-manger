/**
 * What this build may offer, given the store it ships through.
 *
 * The App Store forbids steering to an outside payment for digital goods
 * (guideline 3.1.1, ADR 0019) and requires Sign in with Apple next to any
 * third-party login (4.8, ADR 0020). Until both are handled natively, iOS
 * offers neither the Stripe subscription nor Google. Android and web are
 * unchanged.
 */
export interface PlatformCapabilities {
  /** The Stripe subscription: paywalls, prices, Checkout, Customer Portal. */
  billing: boolean
  /** Google sign-in and account linking. */
  googleSignIn: boolean
}

export function capabilitiesFor(os: string): PlatformCapabilities {
  const appStore = os === 'ios'
  return { billing: !appStore, googleSignIn: !appStore }
}
