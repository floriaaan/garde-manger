import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'

async function signUp(client: ApiClient, email: string, name: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name })
  const cookie = response.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  return cookie
}

function deleteAccount(client: ApiClient, cookie: string) {
  return client
    .post('/api/auth/delete-user')
    .headers({ cookie })
    .json({ password: 'correct-horse-battery-staple' })
}

test.group('account deletion: household cleanup', () => {
  test('solo owner deletion also deletes their household', async ({ client }) => {
    const cookie = await signUp(client, 'solo-owner@example.com', 'Solo Owner')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer solo' })

    const response = await deleteAccount(client, cookie)
    response.assertStatus(200)

    const signIn = await client
      .post('/api/auth/sign-in/email')
      .json({ email: 'solo-owner@example.com', password: 'correct-horse-battery-staple' })
    signIn.assertStatus(401)
  })

  test('plain member deletion just leaves the household', async ({ client }) => {
    const ownerCookie = await signUp(client, 'del-owner@example.com', 'Del Owner')
    const create = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer del' })
    const inviteCode = create.body().household.inviteCode

    const memberCookie = await signUp(client, 'del-member@example.com', 'Del Member')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await deleteAccount(client, memberCookie)
    response.assertStatus(200)

    const mineAsOwner = await client.get('/api/households/mine').headers({ cookie: ownerCookie })
    mineAsOwner.assertBodyContains({ household: { name: 'Foyer del' } })
  })

  test('owner of a multi-member household must transfer ownership before deleting', async ({
    client,
  }) => {
    const ownerCookie = await signUp(client, 'blocked-owner@example.com', 'Blocked Owner')
    const create = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer bloqué' })
    const inviteCode = create.body().household.inviteCode

    const memberCookie = await signUp(client, 'blocked-member@example.com', 'Blocked Member')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await deleteAccount(client, ownerCookie)
    response.assertStatus(400)

    const mine = await client.get('/api/households/mine').headers({ cookie: ownerCookie })
    mine.assertBodyContains({ household: { name: 'Foyer bloqué' } })
  })
})

test('solo owner deletion cancels Stripe before its entitlement row is removed by cascade', async ({ client, assert }) => {
  const cookie = await signUp(client, 'solo-stripe-payer@example.com', 'Solo Stripe Payer')
  const created = await client.post('/api/households').headers({ cookie }).json({ name: 'Solo billed household' })
  const householdId = created.body().household.id
  const user = await db.from('user').where('email', 'solo-stripe-payer@example.com').first()
  if (!user) throw new Error('Missing payer')
  const subscriptions = await app.container.make('settings.subscriptions')
  await subscriptions.upsert({ householdId, payerUserId: user.id, stripeCustomerId: 'cus_solo', stripeSubscriptionId: 'sub_solo', expiresAt: new Date('2027-01-01'), cancelAtPeriodEnd: false })
  const billing = await app.container.make('settings.billing')
  const originalCancel = billing.cancelSubscription
  const cancelled: string[] = []
  billing.cancelSubscription = async (id) => {
    cancelled.push(id)
    // Still present when cancellation is requested; cascade must happen afterwards.
    assert.isNotNull(await subscriptions.find(householdId))
  }
  try {
    const response = await deleteAccount(client, cookie)
    response.assertStatus(200)
    assert.deepEqual(cancelled, ['sub_solo'])
    assert.isNull(await subscriptions.find(householdId))
  } finally { billing.cancelSubscription = originalCancel }
})
