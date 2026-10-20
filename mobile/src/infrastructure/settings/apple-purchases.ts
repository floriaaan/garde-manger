import type { ApplePurchases } from '../../domain/settings/apple-purchases.js'

// Metro selects apple-purchases.ios.ts only for the native iOS build.
export const applePurchases: ApplePurchases | null = null
