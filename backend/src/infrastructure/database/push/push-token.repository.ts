import db from '@adonisjs/lucid/services/db'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { DigestTarget, PushToken } from '#domain/push/push-token'

export class LucidPushTokenRepository implements PushTokenRepository {
  async upsert(token: PushToken): Promise<void> {
    await db
      .table('push_token')
      .insert({
        id: token.id,
        user_id: token.userId,
        token: token.token,
        platform: token.platform,
      })
      .onConflict('token')
      // A device changing account moves the token; the new owner gets today's digest afresh.
      .merge({
        user_id: token.userId,
        platform: token.platform,
        last_digest_on: null,
        updated_at: new Date(),
      })
  }

  async deleteForUser(userId: string, token: string): Promise<void> {
    await db.from('push_token').where({ user_id: userId, token }).delete()
  }

  async deleteMany(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return
    await db.from('push_token').whereIn('token', tokens).delete()
  }

  async listForUser(userId: string): Promise<string[]> {
    const rows = await db.from('push_token').where('user_id', userId).select('token')
    return rows.map((row) => row.token)
  }

  async listDigestDue(day: string): Promise<DigestTarget[]> {
    const rows = await db
      .from('push_token')
      .join('household_member', 'household_member.user_id', 'push_token.user_id')
      .where((query) => {
        query.whereNull('push_token.last_digest_on').orWhere('push_token.last_digest_on', '<', day)
      })
      .select(
        'push_token.token as token',
        'push_token.user_id as user_id',
        'household_member.household_id as household_id',
      )
    return rows.map((row) => ({
      token: row.token,
      userId: row.user_id,
      householdId: row.household_id,
    }))
  }

  async markDigested(tokens: string[], day: string): Promise<void> {
    if (tokens.length === 0) return
    await db.from('push_token').whereIn('token', tokens).update({ last_digest_on: day })
  }
}
