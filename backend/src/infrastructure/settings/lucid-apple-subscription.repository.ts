import db from '@adonisjs/lucid/services/db'
import type { AppleEntitlement, AppleSubscriptionRepository } from '#domain/settings/interfaces/apple-subscription-port.interface'
import type { HouseholdSubscription } from '#domain/settings/interfaces/subscription-port.interface'

export class LucidAppleSubscriptionRepository implements AppleSubscriptionRepository {
  async attach(entitlement: AppleEntitlement, userId: string, householdId: string): Promise<boolean> {
    // One original transaction can belong to only one payer/household. Replays
    // cannot roll status back, while an authenticated restore can reattach it.
    return db.transaction(async (trx) => {
      // Serialize against household-member deletion so leaving cannot race a restore.
      const member = await trx.from('household_member').where('user_id', userId)
        .where('household_id', householdId).forUpdate().first()
      if (!member) return false
      const result = await trx.rawQuery(`
        INSERT INTO apple_subscription
          (id, original_transaction_id, environment, payer_user_id, household_id, expires_at, cancel_at_period_end, signed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          household_id = EXCLUDED.household_id,
          payer_user_id = EXCLUDED.payer_user_id,
          expires_at = CASE WHEN EXCLUDED.signed_at >= apple_subscription.signed_at THEN EXCLUDED.expires_at ELSE apple_subscription.expires_at END,
          cancel_at_period_end = CASE WHEN EXCLUDED.signed_at >= apple_subscription.signed_at THEN EXCLUDED.cancel_at_period_end ELSE apple_subscription.cancel_at_period_end END,
          signed_at = GREATEST(EXCLUDED.signed_at, apple_subscription.signed_at)
        WHERE apple_subscription.payer_user_id IS NULL OR apple_subscription.payer_user_id = EXCLUDED.payer_user_id
        RETURNING id
      `, [entitlement.id, entitlement.originalTransactionId, entitlement.environment, userId, householdId,
        entitlement.expiresAt, entitlement.cancelAtPeriodEnd, entitlement.signedAt])
      return result.rows.length === 1
    })
  }

  async update(entitlement: AppleEntitlement): Promise<void> {
    await db.from('apple_subscription').where('id', entitlement.id)
      .where('signed_at', '<=', entitlement.signedAt)
      .update({ expires_at: entitlement.expiresAt, cancel_at_period_end: entitlement.cancelAtPeriodEnd, signed_at: entitlement.signedAt })
  }

  async findActive(householdId: string, now: Date): Promise<HouseholdSubscription | null> {
    const row = await db.from('apple_subscription').where('household_id', householdId)
      .whereNotNull('payer_user_id').where('expires_at', '>', now).orderBy('expires_at', 'desc').first()
    return row ? {
      provider: 'apple', payerUserId: row.payer_user_id,
      stripeCustomerId: null, stripeSubscriptionId: null,
      expiresAt: new Date(row.expires_at), cancelAtPeriodEnd: row.cancel_at_period_end,
    } : null
  }

  async detachForPayer(userId: string): Promise<void> {
    await db.from('apple_subscription').where('payer_user_id', userId).update({ household_id: null })
  }
}
