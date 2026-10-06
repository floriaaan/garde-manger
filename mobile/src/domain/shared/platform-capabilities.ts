/**
 * What this build may offer, given the store it ships through.
 *
 * The App Store forbids steering to an outside payment for digital goods
 * (guideline 3.1.1, ADR 0019) and requires Sign in with Apple next to any
 * third-party login (4.8, ADR 0020). Google on iOS is enabled by
 * auth-methods.query only when Apple is configured on the server. Stripe
 * billing is delegated to the web subscription page on iOS.
 */
export interface PlatformCapabilities {
  /** Direct Stripe billing: paywalls, prices, Checkout, Customer Portal. */
  billing: boolean
  /** Google sign-in and account linking by default; iOS has a server-side Apple prerequisite. */
  googleSignIn: boolean
}

export function capabilitiesFor(os: string): PlatformCapabilities {
  const appStore = os === 'ios'
  return { billing: !appStore, googleSignIn: !appStore }
}
