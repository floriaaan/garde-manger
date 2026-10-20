import type { SubscriptionPort, SubscriptionUpsert, HouseholdSubscription } from '#domain/settings/interfaces/subscription-port.interface'
import type { AppleSubscriptionRepository } from '#domain/settings/interfaces/apple-subscription-port.interface'
import type { Clock } from '#domain/shared/clock.interface'

/** Independent payment sources; a Stripe event can never expire an Apple entitlement. */
export class CombinedSubscriptionAdapter implements SubscriptionPort {
  constructor(private readonly stripe: SubscriptionPort, private readonly apple: AppleSubscriptionRepository, private readonly clock: Clock) {}

  async find(householdId: string): Promise<HouseholdSubscription | null> {
    const [stripe, apple] = await Promise.all([this.stripe.find(householdId), this.apple.findActive(householdId, this.clock.now())])
    if (apple && (!stripe || apple.expiresAt > stripe.expiresAt)) return apple
    return stripe ? { ...stripe, provider: 'stripe' } : null
  }

  async hasActiveSubscription(householdId: string | null): Promise<boolean> {
    if (!householdId) return false
    const subscription = await this.find(householdId)
    return !!subscription && subscription.expiresAt > this.clock.now()
  }

  upsert(params: SubscriptionUpsert) { return this.stripe.upsert(params) }

  async revokeForPayer(userId: string, now: Date): Promise<string[]> {
    await this.apple.detachForPayer(userId)
    return this.stripe.revokeForPayer(userId, now)
  }
}
