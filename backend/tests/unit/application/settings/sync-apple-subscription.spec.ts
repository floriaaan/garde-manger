import { test } from '@japa/runner'
import { SyncAppleSubscription } from '#application/settings/sync-apple-subscription.use-case'
import { CombinedSubscriptionAdapter } from '#infrastructure/settings/combined-subscription.adapter'
import type { AppleEntitlement, AppleStorePort, AppleSubscriptionRepository } from '#domain/settings/interfaces/apple-subscription-port.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'

const now = new Date('2026-10-21T00:00:00Z')
const expiry = new Date('2026-11-21T00:00:00Z')
const entitlement: AppleEntitlement = {
  id: 'Production:original-1', originalTransactionId: 'original-1', environment: 'Production',
  appAccountToken: 'account-1', expiresAt: expiry, cancelAtPeriodEnd: false, signedAt: now,
}

test('sync rejects a receipt belonging to another app account without writing entitlement', async ({ assert }) => {
  let writes = 0
  const store = { accountToken: () => 'account-2', verifyPurchase: async () => entitlement } as unknown as AppleStorePort
  const apple = { attach: async () => { writes++; return true } } as unknown as AppleSubscriptionRepository
  const households = { findByUserId: async () => ({ id: 'h1' }) } as unknown as HouseholdRepository
  const result = await new SyncAppleSubscription(store, apple, households, { now: () => now })
    .execute({ userId: 'u2', signedTransaction: 'signed-by-apple' })
  assert.deepEqual(result, { ok: false, error: 'apple_account_mismatch' })
  assert.equal(writes, 0)
})

test('sync binds the verified purchase to the authenticated payer and their household', async ({ assert }) => {
  const writes: unknown[] = []
  const store = { accountToken: () => 'account-1', verifyPurchase: async () => entitlement } as unknown as AppleStorePort
  const apple = { attach: async (...args: unknown[]) => { writes.push(args); return true } } as unknown as AppleSubscriptionRepository
  const households = { findByUserId: async () => ({ id: 'h1' }) } as unknown as HouseholdRepository
  const result = await new SyncAppleSubscription(store, apple, households, { now: () => now })
    .execute({ userId: 'u1', signedTransaction: 'signed-by-apple' })
  assert.deepEqual(result, { ok: true, value: { active: true } })
  assert.deepEqual(writes, [[entitlement, 'u1', 'h1']])
})

test('an expired or refunded purchase never returns active access', async ({ assert }) => {
  const store = { accountToken: () => 'account-1', verifyPurchase: async () => ({ ...entitlement, expiresAt: new Date(0) }) } as unknown as AppleStorePort
  const apple = { attach: async () => true } as unknown as AppleSubscriptionRepository
  const households = { findByUserId: async () => ({ id: 'h1' }) } as unknown as HouseholdRepository
  const result = await new SyncAppleSubscription(store, apple, households, { now: () => now })
    .execute({ userId: 'u1', signedTransaction: 'signed-but-no-longer-active' })
  assert.deepEqual(result, { ok: true, value: { active: false } })
})

test('Stripe expiration cannot remove an independent Apple entitlement; payer removal detaches Apple', async ({ assert }) => {
  let detached = false
  let stripeWrites = 0
  const stripe = {
    find: async () => ({ payerUserId: 'u1', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', expiresAt: new Date(0), cancelAtPeriodEnd: false }),
    upsert: async () => { stripeWrites++ }, revokeForPayer: async () => ['sub_1'],
  } as unknown as SubscriptionPort
  const apple = {
    findActive: async () => detached ? null : ({ payerUserId: 'u1', provider: 'apple', stripeCustomerId: null, stripeSubscriptionId: null, expiresAt: expiry, cancelAtPeriodEnd: false }),
    detachForPayer: async () => { detached = true },
  } as unknown as AppleSubscriptionRepository
  const subscriptions = new CombinedSubscriptionAdapter(stripe, apple, { now: () => now })
  await subscriptions.upsert({ householdId: 'h1', payerUserId: 'u1', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', expiresAt: new Date(0), cancelAtPeriodEnd: false })
  assert.equal(stripeWrites, 1)
  assert.isTrue(await subscriptions.hasActiveSubscription('h1'))
  assert.equal((await subscriptions.find('h1'))?.provider, 'apple')
  assert.deepEqual(await subscriptions.revokeForPayer('u1', now), ['sub_1'])
  assert.isFalse(await subscriptions.hasActiveSubscription('h1'))
})
