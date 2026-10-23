import type { HouseholdSubscription } from './subscription-port.interface.js'

/** Only populated after Apple signature and current subscription status verification. */
export interface AppleEntitlement {
  id: string
  originalTransactionId: string
  environment: 'Production' | 'Sandbox'
  appAccountToken: string
  expiresAt: Date
  cancelAtPeriodEnd: boolean
  signedAt: Date
}

export class InvalidApplePurchaseError extends Error {}

export interface AppleStorePort {
  productId: string
  accountToken(userId: string): string
  verifyPurchase(signedTransaction: string): Promise<AppleEntitlement>
  verifyNotification(signedPayload: string): Promise<AppleEntitlement | null>
}

export interface AppleSubscriptionRepository {
  /** A restore may move the payer's subscription to their current household. */
  attach(entitlement: AppleEntitlement, userId: string, householdId: string): Promise<boolean>
  /** Notifications update status only, never restore a detached household association. */
  update(entitlement: AppleEntitlement): Promise<void>
  findActive(householdId: string, now: Date): Promise<HouseholdSubscription | null>
  detachForPayer(userId: string): Promise<void>
}
