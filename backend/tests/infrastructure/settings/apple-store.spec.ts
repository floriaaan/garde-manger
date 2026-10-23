import { test } from '@japa/runner'
import { Environment, Status, Type } from '@apple/app-store-server-library'
import { AppleStoreAdapter } from '#infrastructure/settings/apple-store.adapter'

const transaction = {
  productId: 'ai.monthly',
  type: Type.AUTO_RENEWABLE_SUBSCRIPTION,
  inAppOwnershipType: 'PURCHASED',
  originalTransactionId: 'original-1',
  appAccountToken: 'account-1',
  expiresDate: Date.parse('2026-11-21'),
  signedDate: Date.parse('2026-10-21'),
}

function setup(status: Status, changes = {}) {
  let apiCalls = 0
  const connection = {
    environment: Environment.PRODUCTION,
    verifier: {
      verifyAndDecodeTransaction: async (jws: string) => {
        if (jws === 'forged') throw new Error('bad signature')
        return { ...transaction, ...changes }
      },
      verifyAndDecodeRenewalInfo: async () => ({
        originalTransactionId: 'original-1',
        autoRenewStatus: 0,
        signedDate: Date.parse('2026-10-22'),
        gracePeriodExpiresDate: Date.parse('2026-11-25'),
      }),
      verifyAndDecodeNotification: async () => ({ data: { signedTransactionInfo: 'verified' } }),
    },
    client: {
      getAllSubscriptionStatuses: async () => {
        apiCalls++
        return {
          data: [
            {
              lastTransactions: [
                {
                  originalTransactionId: 'original-1',
                  status,
                  signedTransactionInfo: 'verified',
                  signedRenewalInfo: 'renewal',
                },
              ],
            },
          ],
        }
      },
    },
  }
  const store = new AppleStoreAdapter('ai.monthly', [
    connection,
  ] as unknown as ConstructorParameters<typeof AppleStoreAdapter>[1])
  return { store, apiCalls: () => apiCalls }
}

test('forged receipts never reach subscription status lookup', async ({ assert }) => {
  const { store, apiCalls } = setup(Status.ACTIVE)
  await assert.rejects(() => store.verifyPurchase('forged'))
  assert.equal(apiCalls(), 0)
})

test('a valid receipt is reconciled with current status, not trusted after a refund', async ({
  assert,
}) => {
  for (const status of [Status.EXPIRED, Status.REVOKED, Status.BILLING_RETRY]) {
    const { store } = setup(status)
    const entitlement = await store.verifyPurchase('valid-old-receipt')
    assert.equal(entitlement.expiresAt.getTime(), 0)
  }
})

test('auto-renewal cancellation preserves the paid period and grace uses the Apple grace end', async ({
  assert,
}) => {
  const active = await setup(Status.ACTIVE).store.verifyPurchase('valid')
  assert.equal(active.expiresAt.getTime(), transaction.expiresDate)
  assert.isTrue(active.cancelAtPeriodEnd)
  const grace = await setup(Status.BILLING_GRACE_PERIOD).store.verifyPurchase('valid')
  assert.equal(grace.expiresAt.getTime(), Date.parse('2026-11-25'))
})

test('other products and family-shared receipts cannot unlock this subscription', async ({
  assert,
}) => {
  await assert.rejects(() =>
    setup(Status.ACTIVE, { productId: 'another-product' }).store.verifyPurchase('valid'),
  )
  await assert.rejects(() =>
    setup(Status.ACTIVE, { inAppOwnershipType: 'FAMILY_SHARED' }).store.verifyPurchase('valid'),
  )
})

test('notifications fetch the latest status so replaying an old renewal cannot undo a revocation', async ({
  assert,
}) => {
  const { store, apiCalls } = setup(Status.REVOKED)
  const entitlement = await store.verifyNotification('old-renewal-notification')
  assert.equal(entitlement?.expiresAt.getTime(), 0)
  assert.equal(apiCalls(), 1)
})
