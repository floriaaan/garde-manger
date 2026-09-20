import type { UseCase } from '#application/shared/use-case'
import type { BillingPort } from '#domain/settings/interfaces/billing-port.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export type SubscriptionUrlError = 'no_household' | 'already_subscribed' | 'no_subscription'

/** Hands the mobile app a Stripe Checkout URL for the caller's household (docs/adr/0015). */
export class StartSubscriptionCheckout implements UseCase<
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
    if (await this.subscriptions.hasActiveSubscription(household.id))
      return Result.err('already_subscribed')

    const existing = await this.subscriptions.find(household.id)
    const url = await this.billing.createCheckoutUrl({
      householdId: household.id,
      payerUserId: userId,
      customerId: existing?.stripeCustomerId ?? null,
    })
    return Result.ok({ url })
  }
}
