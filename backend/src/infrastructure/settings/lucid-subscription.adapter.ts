import { DateTime } from 'luxon'
import HouseholdSubscriptionModel from '#infrastructure/database/settings/household-subscription.lucid'
import type {
  HouseholdSubscription,
  SubscriptionPort,
  SubscriptionUpsert,
} from '#domain/settings/interfaces/subscription-port.interface'

/**
 * Reads/writes `household_subscription` — only ever consulted on the hosted
 * instance (cf. `EnvAiSettingsProvider`, which short-circuits to
 * `plan: 'self-hosted'` before calling this at all).
 */
export class LucidSubscriptionAdapter implements SubscriptionPort {
  async hasActiveSubscription(householdId: string | null): Promise<boolean> {
    if (!householdId) return false
    const row = await this.find(householdId)
    return row !== null && row.expiresAt.getTime() > Date.now()
  }

  async find(householdId: string): Promise<HouseholdSubscription | null> {
    const row = await HouseholdSubscriptionModel.find(householdId)
    if (!row) return null
    return {
      payerUserId: row.payerUserId,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      expiresAt: row.expiresAt.toJSDate(),
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    }
  }

  async revokeForPayer(userId: string, now: Date): Promise<string[]> {
    const rows = await HouseholdSubscriptionModel.query().where('payer_user_id', userId)
    await HouseholdSubscriptionModel.query()
      .where('payer_user_id', userId)
      .update({ expiresAt: DateTime.fromJSDate(now) })
    return rows.flatMap((row) => (row.stripeSubscriptionId ? [row.stripeSubscriptionId] : []))
  }

  async upsert(params: SubscriptionUpsert): Promise<void> {
    await HouseholdSubscriptionModel.updateOrCreate(
      { householdId: params.householdId },
      {
        payerUserId: params.payerUserId,
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        expiresAt: DateTime.fromJSDate(params.expiresAt),
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      },
    )
  }
}
