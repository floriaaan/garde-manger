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
      .merge({
        user_id: token.userId,
        platform: token.platform,
        // Syncing an unchanged account must not re-arm today's digest.
        last_digest_on: db.raw(
          'CASE WHEN push_token.user_id = EXCLUDED.user_id THEN push_token.last_digest_on ELSE NULL END',
        ),
        updated_at: new Date(),
      })
  }

  async upsertWeb(subscription: {
    id: string
    userId: string
    endpoint: string
    keys: { p256dh: string; auth: string }
  }): Promise<void> {
    await db
      .table('web_push_subscription')
      .insert({
        id: subscription.id,
        user_id: subscription.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      })
      .onConflict('endpoint')
      .merge({
        user_id: subscription.userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        last_digest_on: db.raw(
          'CASE WHEN web_push_subscription.user_id = EXCLUDED.user_id THEN web_push_subscription.last_digest_on ELSE NULL END',
        ),
      })
  }

  async deleteForUser(userId: string, token: string): Promise<void> {
    await db.from('push_token').where({ user_id: userId, token }).delete()
    await db.from('web_push_subscription').where({ user_id: userId, endpoint: token }).delete()
  }

  async deleteMany(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return
    await db.from('push_token').whereIn('token', tokens).delete()
    await db.from('web_push_subscription').whereIn('endpoint', tokens).delete()
  }

  async listForUser(userId: string): Promise<string[]> {
    const rows = await db.from('push_token').where('user_id', userId).select('token')
    return rows.map((row) => row.token)
  }

  async listDigestDue(day: string): Promise<DigestTarget[]> {
    const native = await db
      .from('push_token')
      .join('household_member', 'household_member.user_id', 'push_token.user_id')
      .where((query) => {
        query.whereNull('push_token.last_digest_on').orWhere('push_token.last_digest_on', '<', day)
      })
      .select(
        'push_token.token as token',
        'push_token.user_id as user_id',
        'household_member.household_id as household_id',
        'push_token.platform as platform',
      )
    const web = await db
      .from('web_push_subscription')
      .join('household_member', 'household_member.user_id', 'web_push_subscription.user_id')
      .where((query) => {
        query
          .whereNull('web_push_subscription.last_digest_on')
          .orWhere('web_push_subscription.last_digest_on', '<', day)
      })
      .select(
        'web_push_subscription.endpoint as token',
        'web_push_subscription.user_id as user_id',
        'household_member.household_id as household_id',
        'web_push_subscription.p256dh',
        'web_push_subscription.auth',
      )
    return [...native, ...web].map((row) => ({
      token: row.token,
      userId: row.user_id,
      householdId: row.household_id,
      platform: row.p256dh ? 'web' : row.platform,
      ...(row.p256dh ? { keys: { p256dh: row.p256dh, auth: row.auth } } : {}),
    }))
  }

  async claimDigest(targets: DigestTarget[], day: string): Promise<DigestTarget[]> {
    const claimed: DigestTarget[] = []
    for (const platform of ['native', 'web'] as const) {
      const matching = targets.filter(
        (target) => (target.platform === 'web') === (platform === 'web'),
      )
      if (matching.length === 0) continue
      const table = platform === 'web' ? 'web_push_subscription' : 'push_token'
      const tokenColumn = platform === 'web' ? 'endpoint' : 'token'
      const rows = await db
        .from(table)
        .whereIn(
          tokenColumn,
          matching.map((target) => target.token),
        )
        .where((query) => query.whereNull('last_digest_on').orWhere('last_digest_on', '<', day))
        .update({ last_digest_on: day }, [tokenColumn])
      const tokens = new Set(rows.map((row) => row[tokenColumn]))
      claimed.push(...matching.filter((target) => tokens.has(target.token)))
    }
    return claimed
  }
}
