import type { UseCase } from '#application/shared/use-case'
import type { BillingPort } from '#domain/settings/interfaces/billing-port.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { SubscriptionUrlError } from './start-subscription-checkout.use-case.js'

/**
 * Stripe Customer Portal URL for the household — only its payer may open it,
 * since the portal exposes their card and invoices.
 */
export class OpenBillingPortal implements UseCase<
  { userId: string },
  ResultType<{ url: string }, SubscriptionUrlError>
> {
  constructor(
    private readonly billing: BillingPort,
    private readonly subscriptions: SubscriptionPort,
    private readonly households: HouseholdRepository,
  ) {}

  async execute({
    userId,
  }: {
    userId: string
  }): Promise<ResultType<{ url: string }, SubscriptionUrlError>> {
    const household = await this.households.findByUserId(userId)
    if (!household) return Result.err('no_household')

    const subscription = await this.subscriptions.find(household.id)
    if (!subscription?.stripeCustomerId || subscription.payerUserId !== userId) {
      return Result.err('no_subscription')
    }
    return Result.ok({ url: await this.billing.createPortalUrl(subscription.stripeCustomerId) })
  }
}
