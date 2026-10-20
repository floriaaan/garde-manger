import type { AppleStorePort, AppleSubscriptionRepository } from '#domain/settings/interfaces/apple-subscription-port.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Result } from '#domain/shared/result'

export class SyncAppleSubscription {
  constructor(
    private readonly store: AppleStorePort,
    private readonly subscriptions: AppleSubscriptionRepository,
    private readonly households: HouseholdRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { userId: string; signedTransaction: string }) {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    const entitlement = await this.store.verifyPurchase(input.signedTransaction)
    // A signed receipt from another app account must never unlock this account.
    if (entitlement.appAccountToken.toLowerCase() !== this.store.accountToken(input.userId).toLowerCase()) {
      return Result.err('apple_account_mismatch')
    }
    if (!await this.subscriptions.attach(entitlement, input.userId, household.id)) {
      return Result.err('apple_account_mismatch')
    }
    return Result.ok({ active: entitlement.expiresAt > this.clock.now() })
  }
}
