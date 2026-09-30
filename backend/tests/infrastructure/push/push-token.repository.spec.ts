import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidPushTokenRepository } from '#infrastructure/database/push/push-token.repository'

test.group('LucidPushTokenRepository daily claim', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('claims a device once per day even when it re-registers', async ({ assert }) => {
    const now = new Date()
    await db.table('user').insert({
      id: 'u_push',
      name: 'Push',
      email: 'push@example.com',
      email_verified: false,
      created_at: now,
      updated_at: now,
    })
    await db.table('household').insert({
      id: 'h_push',
      name: 'Push',
      owner_id: 'u_push',
      invite_code: 'PUSH1234',
      created_at: now,
      updated_at: now,
    })
    await db.table('household_member').insert({
      id: 'm_push',
      household_id: 'h_push',
      user_id: 'u_push',
      role: 'owner',
      joined_at: now,
    })

    const repository = new LucidPushTokenRepository()
    const token = {
      id: 't_push',
      userId: 'u_push',
      token: 'ExponentPushToken[test]',
      platform: 'ios' as const,
    }
    await repository.upsert(token)
    const due = await repository.listDigestDue('2026-09-20')
    assert.lengthOf(await repository.claimDigest(due, '2026-09-20'), 1)
    assert.lengthOf(await repository.claimDigest(due, '2026-09-20'), 0)
    await repository.upsert(token)
    assert.lengthOf(await repository.listDigestDue('2026-09-20'), 0)
    assert.lengthOf(await repository.listDigestDue('2026-09-21'), 1)
  })
})
