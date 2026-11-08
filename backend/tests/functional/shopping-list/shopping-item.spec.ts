import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer courses' })
  return cookie
}

test.group('shopping-list: CRUD', (group) => {
  test('restock requires a duplicate decision and repeat replacement never accumulates', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'restock-duplicate@example.com')
    const input = {
      name: 'Lait',
      quantity: { amount: 2, unit: 'L' },
      source: 'manual',
      onDuplicate: 'reject',
    }
    const first = await client.post('/api/shopping-items').headers({ cookie }).json(input)
    first.assertStatus(201)
    const duplicate = await client.post('/api/shopping-items').headers({ cookie }).json(input)
    duplicate.assertStatus(409)
    duplicate.assertBodyContains({ error: { type: 'shopping_item_exists' } })

    const keep = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({
        ...input,
        quantity: { amount: 3, unit: 'bouteilles' },
        onDuplicate: 'keep',
        existingItemId: first.body().item.id,
      })
    keep.assertBodyContains({ item: { quantity: { amount: 2, unit: 'L' } } })
    for (let attempt = 0; attempt < 2; attempt++) {
      const replace = await client
        .post('/api/shopping-items')
        .headers({ cookie })
        .json({
          ...input,
          quantity: { amount: 3, unit: 'bouteilles' },
          onDuplicate: 'replace',
          existingItemId: first.body().item.id,
        })
      replace.assertBodyContains({
        item: { id: first.body().item.id, quantity: { amount: 3, unit: 'bouteilles' } },
      })
    }
    const list = await client.get('/api/shopping-items').headers({ cookie })
    assert.lengthOf(list.body().items, 1)
  })

  test('restocking is visible to another household member and cannot target a different foyer', async ({
    client,
  }) => {
    const ownerCookie = await signUpWithHousehold(client, 'restock-owner@example.com')
    const household = await client.get('/api/households/mine').headers({ cookie: ownerCookie })
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'restock-member@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Member',
    })
    const memberCookie = signUp.headers()['set-cookie']
    if (!memberCookie) throw new Error('set-cookie header missing')
    const join = await client
      .post('/api/households/join')
      .headers({ cookie: memberCookie })
      .json({ inviteCode: household.body().household.inviteCode })
    join.assertStatus(200)
    const input = {
      name: 'Lait',
      quantity: { amount: 1, unit: 'L' },
      source: 'manual',
      onDuplicate: 'reject',
    }
    const created = await client
      .post('/api/shopping-items')
      .headers({ cookie: memberCookie })
      .json(input)
    created.assertStatus(201)
    const ownerList = await client.get('/api/shopping-items').headers({ cookie: ownerCookie })
    ownerList.assertBodyContains({ items: [{ id: created.body().item.id, name: 'Lait' }] })
    const otherCookie = await signUpWithHousehold(client, 'restock-other@example.com')
    const refused = await client
      .post('/api/shopping-items')
      .headers({ cookie: otherCookie })
      .json({ ...input, onDuplicate: 'replace', existingItemId: created.body().item.id })
    refused.assertStatus(409)
    const otherList = await client.get('/api/shopping-items').headers({ cookie: otherCookie })
    otherList.assertBodyContains({ items: [] })
  })

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('create → list → update (toggle) → delete', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-crud@example.com')

    const create = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })
    create.assertStatus(201)
    const itemId = create.body().item.id

    const list = await client.get('/api/shopping-items').headers({ cookie })
    list.assertStatus(200)
    list.assertBodyContains({ items: [{ name: 'Farine', checked: false }] })

    const toggle = await client
      .patch(`/api/shopping-items/${itemId}`)
      .headers({ cookie })
      .json({ checked: true })
    toggle.assertBodyContains({ item: { checked: true } })

    const destroy = await client.delete(`/api/shopping-items/${itemId}`).headers({ cookie })
    destroy.assertStatus(204)

    const afterDelete = await client.get('/api/shopping-items').headers({ cookie })
    afterDelete.assertBodyContains({ items: [] })
  })

  test('create rejects a non-integer quantity', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-validation@example.com')
    const response = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Lait', quantity: { amount: 0.5, unit: 'L' }, source: 'manual' })
    response.assertStatus(400)
  })

  test('create rejects an unknown source', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-badsource@example.com')
    const response = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Lait', quantity: { amount: 1, unit: 'L' }, source: 'not-a-source' })
    response.assertStatus(422)
  })

  test('update on an unknown item returns 404', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-404@example.com')
    const response = await client
      .patch('/api/shopping-items/does-not-exist')
      .headers({ cookie })
      .json({ checked: true })
    response.assertStatus(404)
    response.assertBodyContains({ error: { type: 'shopping_item_not_found' } })
  })

  test('accessing another household item returns 404, not a leak', async ({ client }) => {
    const cookieA = await signUpWithHousehold(client, 'shopping-household-a@example.com')
    const create = await client
      .post('/api/shopping-items')
      .headers({ cookie: cookieA })
      .json({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })
    create.assertStatus(201)
    const itemId = create.body().item.id

    const cookieB = await signUpWithHousehold(client, 'shopping-household-b@example.com')

    const patch = await client
      .patch(`/api/shopping-items/${itemId}`)
      .headers({ cookie: cookieB })
      .json({ checked: true })
    patch.assertStatus(404)
    patch.assertBodyContains({ error: { type: 'shopping_item_not_found' } })

    const destroy = await client
      .delete(`/api/shopping-items/${itemId}`)
      .headers({ cookie: cookieB })
    destroy.assertStatus(404)
    destroy.assertBodyContains({ error: { type: 'shopping_item_not_found' } })
  })

  test('adding the same name twice merges the quantity instead of duplicating the line', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-merge@example.com')

    const first = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Farine', quantity: { amount: 300, unit: 'g' }, source: 'manual' })
    first.assertStatus(201)

    // Different case/accents/whitespace, different unit in the same family
    // (kg converts to the finer g), different source — still the same line.
    const second = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: '  FARINE  ', quantity: { amount: 1, unit: 'kg' }, source: 'recipe' })
    second.assertStatus(201)
    second.assertBodyContains({
      item: { id: first.body().item.id, quantity: { amount: 1300, unit: 'g' } },
    })

    const list = await client.get('/api/shopping-items').headers({ cookie })
    list.assertBodyContains({ items: [{ name: 'Farine', quantity: { amount: 1300, unit: 'g' } }] })
    assert.equal(list.body().items.length, 1)
  })

  test('same name, incompatible units: kept as two separate lines', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-nomerge@example.com')

    await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Farine', quantity: { amount: 1, unit: 'unité' }, source: 'manual' })
    await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })

    const list = await client.get('/api/shopping-items').headers({ cookie })
    assert.equal(list.body().items.length, 2)
  })

  test('a checked item does not absorb a fresh add of the same name', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-checked@example.com')

    const first = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })
    await client
      .patch(`/api/shopping-items/${first.body().item.id}`)
      .headers({ cookie })
      .json({ checked: true })

    await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })

    const list = await client.get('/api/shopping-items').headers({ cookie })
    assert.equal(list.body().items.length, 2)
  })

  test('all shopping-item routes require a household', async ({ client }) => {
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'shopping-no-household@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Test',
    })
    const cookie = signUp.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')

    const response = await client.get('/api/shopping-items').headers({ cookie })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'no_household' } })
  })
})
