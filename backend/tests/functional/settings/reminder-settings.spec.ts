import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

async function signUp(client: import('@japa/api-client').ApiClient, email: string) {
  const response = await client.post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = response.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  return cookie
}

const endpoint = '/api/settings/expiry-reminders'

test.group('notification preferences', (group) => {
  group.each.setup(() => db.beginGlobalTransaction())
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('defaults to enabled expiry reminders and an enabled weekly Monday check-up', async ({ client }) => {
    const cookie = await signUp(client, 'reminders-default@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer' })
    const response = await client.get(endpoint).headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ days: 2, enabled: true, checkupEnabled: true, checkupDay: 1 })
  })

  test('partial updates persist independently and preserve the existing delay', async ({ client }) => {
    const cookie = await signUp(client, 'reminders-update@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer' })
    const delay = await client.patch(endpoint).headers({ cookie }).json({ days: 7 })
    delay.assertStatus(200)
    const expiry = await client.patch(endpoint).headers({ cookie }).json({ enabled: false })
    expiry.assertStatus(200)
    expiry.assertBodyContains({ days: 7, enabled: false, checkupEnabled: true })
    const checkup = await client.patch(endpoint).headers({ cookie })
      .json({ checkupEnabled: false, checkupDay: 5 })
    checkup.assertStatus(200)
    const read = await client.get(endpoint).headers({ cookie })
    read.assertBodyContains({ days: 7, enabled: false, checkupEnabled: false, checkupDay: 5 })
  })

  test('creating preferences first preserves them when the delay is later changed', async ({ client }) => {
    const cookie = await signUp(client, 'reminders-preferences-first@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer' })
    const preferences = await client.patch(endpoint).headers({ cookie })
      .json({ checkupEnabled: false, checkupDay: 0 })
    preferences.assertStatus(200)
    const delay = await client.patch(endpoint).headers({ cookie }).json({ days: 0 })
    delay.assertBodyContains({ days: 0, enabled: true, checkupEnabled: false, checkupDay: 0 })
  })

  test('rejects an invalid weekday and a user without a household', async ({ client }) => {
    const cookie = await signUp(client, 'reminders-invalid@example.com')
    const noHousehold = await client.patch(endpoint).headers({ cookie }).json({ enabled: false })
    noHousehold.assertStatus(404)
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer' })
    for (const checkupDay of [-1, 7, 1.5]) {
      const response = await client.patch(endpoint).headers({ cookie }).json({ checkupDay })
      response.assertStatus(422)
    }
  })
})
