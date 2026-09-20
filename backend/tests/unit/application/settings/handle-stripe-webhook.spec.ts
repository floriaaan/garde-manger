import { test } from '@japa/runner'
import { createHmac } from 'node:crypto'
import { HandleStripeWebhook } from '#application/settings/handle-stripe-webhook.use-case'
import type { StripeSubscriptionEvent } from '#application/settings/handle-stripe-webhook.use-case'
import { isValidStripeSignature } from '#infrastructure/settings/stripe-signature'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type {
  HouseholdSubscription,
  SubscriptionPort,
  SubscriptionUpsert,
} from '#domain/settings/interfaces/subscription-port.interface'

const NOW = new Date('2026-09-18T10:00:00Z')
const PERIOD_END = Date.parse('2026-10-18T00:00:00Z') / 1000

function fakeHousehold(id: string): Household {
  const invite = InviteCode.create('ABCD1234')
  if (!invite.ok) throw new Error('bad fixture invite code')
  return Household.create({
    id,
    name: 'Foyer test',
    ownerId: 'u_owner',
    ownerMemberId: 'm_owner',
    inviteCode: invite.value,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })
}

class FakeHouseholdRepository implements HouseholdRepository {
  constructor(private readonly households: Household[]) {}
  async findById(id: string) {
    return this.households.find((h) => h.id === id) ?? null
  }
  async findByUserId() {
    return null
  }
  async findByInviteCode() {
    return null
  }
  async save() {}
  async delete() {}
}

class FakeSubscriptionPort implements SubscriptionPort {
  upserts: SubscriptionUpsert[] = []
  constructor(private readonly existing: HouseholdSubscription | null = null) {}
  async hasActiveSubscription() {
    return false
  }
  async find() {
    return this.existing
  }
  async revokeForPayer() {
    return []
  }
  async upsert(params: SubscriptionUpsert) {
    this.upserts.push(params)
  }
}

function event(
  type: string,
  overrides: Partial<StripeSubscriptionEvent['subscription']> = {},
): StripeSubscriptionEvent {
  return {
    type,
    subscription: {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: false,
      metadata: { household_id: 'h_1', payer_user_id: 'u_payer' },
      ...overrides,
    },
  }
}

function useCase(subscriptions: FakeSubscriptionPort, households = [fakeHousehold('h_1')]) {
  return new HandleStripeWebhook(subscriptions, new FakeHouseholdRepository(households), {
    now: () => NOW,
  })
}

test.group('HandleStripeWebhook', () => {
  test('entitles the household until the end of the paid period', async ({ assert }) => {
    const subscriptions = new FakeSubscriptionPort()
    await useCase(subscriptions).execute(event('customer.subscription.created'))

    assert.deepEqual(subscriptions.upserts, [
      {
        householdId: 'h_1',
        payerUserId: 'u_payer',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        expiresAt: new Date(PERIOD_END * 1000),
        cancelAtPeriodEnd: false,
      },
    ])
  })

  test('flags a cancellation scheduled for period end, access kept until then', async ({
    assert,
  }) => {
    const subscriptions = new FakeSubscriptionPort()
    await useCase(subscriptions).execute(
      event('customer.subscription.updated', { cancelAtPeriodEnd: true }),
    )

    assert.isTrue(subscriptions.upserts[0]!.cancelAtPeriodEnd)
    assert.equal(subscriptions.upserts[0]!.expiresAt.getTime(), PERIOD_END * 1000)
  })

  test('keeps access on past_due while Stripe retries the card', async ({ assert }) => {
    const subscriptions = new FakeSubscriptionPort()
    await useCase(subscriptions).execute(
      event('customer.subscription.updated', { status: 'past_due' }),
    )

    assert.equal(subscriptions.upserts[0]!.expiresAt.getTime(), PERIOD_END * 1000)
  })

  test('cuts access now when the subscription is deleted', async ({ assert }) => {
    const subscriptions = new FakeSubscriptionPort()
    await useCase(subscriptions).execute(
      event('customer.subscription.deleted', { status: 'canceled' }),
    )

    assert.deepEqual(subscriptions.upserts[0]!.expiresAt, NOW)
  })

  test('the end of an old subscription does not cut a newer, still-valid one', async ({
    assert,
  }) => {
    const subscriptions = new FakeSubscriptionPort({
      payerUserId: 'u_payer',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_new',
      expiresAt: new Date(PERIOD_END * 1000),
      cancelAtPeriodEnd: false,
    })
    await useCase(subscriptions).execute(
      event('customer.subscription.deleted', { id: 'sub_old', status: 'canceled' }),
    )

    assert.lengthOf(subscriptions.upserts, 0)
  })

  test('ignores an unknown household, missing metadata and other event types', async ({
    assert,
  }) => {
    const subscriptions = new FakeSubscriptionPort()
    await useCase(subscriptions, []).execute(event('customer.subscription.updated'))
    await useCase(subscriptions).execute(event('customer.subscription.updated', { metadata: {} }))
    await useCase(subscriptions).execute(event('invoice.paid'))

    assert.lengthOf(subscriptions.upserts, 0)
  })
})

test.group('isValidStripeSignature', () => {
  const secret = 'whsec_test'
  const body = '{"type":"customer.subscription.updated"}'
  const now = 1_800_000_000
  const sign = (timestamp: number) =>
    createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

  test('accepts a fresh, correctly signed payload', ({ assert }) => {
    assert.isTrue(isValidStripeSignature(body, `t=${now},v1=${sign(now)}`, secret, now))
  })

  test('rejects a tampered body, a wrong secret, a stale timestamp and no header', ({ assert }) => {
    assert.isFalse(isValidStripeSignature(`${body} `, `t=${now},v1=${sign(now)}`, secret, now))
    assert.isFalse(isValidStripeSignature(body, `t=${now},v1=${sign(now)}`, 'whsec_other', now))
    assert.isFalse(
      isValidStripeSignature(body, `t=${now - 600},v1=${sign(now - 600)}`, secret, now),
    )
    assert.isFalse(isValidStripeSignature(body, '', secret, now))
  })
})
