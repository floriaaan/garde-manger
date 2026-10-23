import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidAppleSubscriptionRepository } from '#infrastructure/settings/lucid-apple-subscription.repository'
import type { AppleEntitlement } from '#domain/settings/interfaces/apple-subscription-port.interface'

test.group('Apple entitlement persistence', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('replayed updates cannot undo revocation, notifications cannot reattach a departed payer', async ({
    client,
    assert,
  }) => {
    const signup = await client.post('/api/auth/sign-up/email').json({
      email: 'apple-payer@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Apple Payer',
    })
    const cookie = signup.headers()['set-cookie']
    if (!cookie) throw new Error('Missing session cookie')
    const userId = signup.body().user.id
    const household = await client
      .post('/api/households')
      .headers({ cookie })
      .json({ name: 'Apple household' })
    const householdId = household.body().household.id
    const repository = new LucidAppleSubscriptionRepository()
    const now = new Date('2026-10-21')
    const entitlement: AppleEntitlement = {
      id: 'Production:original-1',
      originalTransactionId: 'original-1',
      environment: 'Production',
      appAccountToken: 'account-1',
      expiresAt: new Date('2027-01-01'),
      cancelAtPeriodEnd: false,
      signedAt: now,
    }
    assert.isTrue(await repository.attach(entitlement, userId, householdId))
    assert.isNotNull(await repository.findActive(householdId, now))
    await repository.update({
      ...entitlement,
      signedAt: new Date('2026-10-22'),
      expiresAt: new Date(0),
    })
    await repository.update(entitlement)
    assert.isNull(await repository.findActive(householdId, now))
    await repository.update({ ...entitlement, signedAt: new Date('2026-10-23') })
    assert.isNotNull(await repository.findActive(householdId, now))
    await repository.detachForPayer(userId)
    await repository.update({ ...entitlement, signedAt: new Date('2026-10-24') })
    assert.isNull(await repository.findActive(householdId, now))
    // Only an authenticated, verified restore may reattach the entitlement.
    await repository.attach(
      { ...entitlement, signedAt: new Date('2026-10-25') },
      userId,
      householdId,
    )
    assert.isNotNull(await repository.findActive(householdId, now))
  })
})
