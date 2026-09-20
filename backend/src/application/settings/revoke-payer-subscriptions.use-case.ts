import type { UseCase } from '#application/shared/use-case'
import type { BillingPort } from '#domain/settings/interfaces/billing-port.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { Clock } from '#domain/shared/clock.interface'

/**
 * A payer who leaves, is removed, or deletes their account: the foyer loses
 * access at once, and — unlike with the stores — the Stripe subscription is
 * cancelled too, since the payer would otherwise have no foyer left to open
 * the billing portal from (docs/adr/0015).
 */
export class RevokePayerSubscriptions implements UseCase<{ userId: string }, void> {
  constructor(
    private readonly subscriptions: SubscriptionPort,
    private readonly billing: BillingPort,
    private readonly clock: Clock,
  ) {}

  async execute({ userId }: { userId: string }): Promise<void> {
    const subscriptionIds = await this.subscriptions.revokeForPayer(userId, this.clock.now())
    await Promise.all(subscriptionIds.map((id) => this.billing.cancelSubscription(id)))
  }
}
