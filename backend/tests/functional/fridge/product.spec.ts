import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer produits' })
  return cookie
}

test.group('fridge: product CRUD, expiring-soon, lookup, image', () => {
  test('create → show → update → delete', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-crud@example.com')

    const create = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Lait',
        quantity: { amount: 1, unit: 'L' },
        location: 'fridge',
        category: 'Produits laitiers',
      })
    create.assertStatus(201)
    const productId = create.body().product.id

    const show = await client.get(`/api/products/${productId}`).headers({ cookie })
    show.assertBodyContains({ product: { name: 'Lait' } })

    const update = await client
      .patch(`/api/products/${productId}`)
      .headers({ cookie })
      .json({ name: 'Lait entier' })
    update.assertBodyContains({ product: { name: 'Lait entier' } })

    const destroy = await client.delete(`/api/products/${productId}`).headers({ cookie })
    destroy.assertStatus(204)

    const afterDelete = await client.get(`/api/products/${productId}`).headers({ cookie })
    afterDelete.assertStatus(404)
  })

  test('create rejects a non-integer quantity', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-validation@example.com')
    const response = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Farine',
        quantity: { amount: 0.5, unit: 'kg' },
        location: 'pantry',
        category: 'Épicerie',
      })
    response.assertStatus(400)
  })

  test('expiring-soon only returns products within the window', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-expiring@example.com')

    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Yaourt',
        quantity: { amount: 1, unit: 'piece' },
        location: 'fridge',
        category: 'Laitier',
        expiresAt: soon,
      })
    await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Conserve',
        quantity: { amount: 1, unit: 'piece' },
        location: 'pantry',
        category: 'Épicerie',
        expiresAt: far,
      })

    const response = await client.get('/api/products/expiring-soon?days=3').headers({ cookie })
    response.assertStatus(200)
    assert.lengthOf(response.body().products, 1)
    assert.equal(response.body().products[0].name, 'Yaourt')
  })

  test('lookup returns the mapped result for a found barcode', async ({ client, cleanup }) => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: 1,
          product: { product_name: 'Nutella', categories_tags: ['en:spreads'] },
        }),
      )) as typeof fetch
    cleanup(() => {
      globalThis.fetch = originalFetch
    })

    const cookie = await signUpWithHousehold(client, 'fridge-lookup@example.com')
    const response = await client
      .get('/api/products/lookup?barcode=3017620422003')
      .headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ result: { name: 'Nutella', openfoodfactId: '3017620422003' } })
  })

  test('image returns 404 when the product has no imageKey', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-image@example.com')
    const create = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Beurre',
        quantity: { amount: 1, unit: 'piece' },
        location: 'fridge',
        category: 'Laitier',
      })
    const productId = create.body().product.id

    const response = await client.get(`/api/products/${productId}/image`).headers({ cookie })
    response.assertStatus(404)
  })

  async function createYaourts(client: import('@japa/api-client').ApiClient, cookie: string) {
    const create = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Yaourts nature',
        quantity: { amount: 6, unit: 'unités' },
        location: 'fridge',
        category: 'Produits laitiers',
        price: 3,
      })
    create.assertStatus(201)
    return create.body().product.id as string
  }

  test('outcomes: one eaten, then the rest thrown away', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-flow@example.com')
    const productId = await createYaourts(client, cookie)

    const one = await client
      .post(`/api/products/${productId}/outcomes`)
      .headers({ cookie })
      .json({ kind: 'consumed', amount: 1 })
    one.assertStatus(200)
    one.assertBodyContains({
      product: { id: productId, quantity: { amount: 5 }, initialQuantity: 6 },
      outcome: { kind: 'consumed', quantity: { amount: 1 }, price: 0.5, discardReason: null },
    })

    const rest = await client
      .post(`/api/products/${productId}/outcomes`)
      .headers({ cookie })
      .json({ kind: 'discarded', discardReason: 'spoiled' })
    rest.assertStatus(200)
    assert.isNull(rest.body().product)
    rest.assertBodyContains({
      outcome: { kind: 'discarded', quantity: { amount: 5 }, discardReason: 'spoiled' },
    })

    const gone = await client.get(`/api/products/${productId}`).headers({ cookie })
    gone.assertStatus(404)

    const rows = await db.from('product_outcome').where('product_id', productId).orderBy('amount')
    assert.deepEqual(
      rows.map((row) => [row.kind, row.amount]),
      [
        ['consumed', 1],
        ['discarded', 5],
      ],
    )
  })

  test('outcomes: another household product is a 404 and stays put', async ({ client }) => {
    const cookieA = await signUpWithHousehold(client, 'outcome-owner@example.com')
    const cookieB = await signUpWithHousehold(client, 'outcome-intruder@example.com')
    const productId = await createYaourts(client, cookieA)

    const response = await client
      .post(`/api/products/${productId}/outcomes`)
      .headers({ cookie: cookieB })
      .json({ kind: 'discarded' })
    response.assertStatus(404)

    const still = await client.get(`/api/products/${productId}`).headers({ cookie: cookieA })
    still.assertBodyContains({ product: { quantity: { amount: 6 } } })
  })

  test('outcomes: a domain-level rejection is 400 and changes nothing', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-invalid@example.com')
    const productId = await createYaourts(client, cookie)

    // Both pass the request validator on their own — the amount and the
    // reason/kind combination are only wrong once the use-case checks them.
    for (const body of [
      { kind: 'consumed', amount: 7 },
      { kind: 'consumed', discardReason: 'expired' },
    ]) {
      const response = await client
        .post(`/api/products/${productId}/outcomes`)
        .headers({ cookie })
        .json(body)
      response.assertStatus(400)
    }

    const still = await client.get(`/api/products/${productId}`).headers({ cookie })
    still.assertBodyContains({ product: { quantity: { amount: 6 } } })
  })

  test('outcomes: a malformed request is 422, same as every other validator in this app', async ({
    client,
  }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-malformed@example.com')
    const productId = await createYaourts(client, cookie)

    for (const body of [
      { kind: 'deleted' },
      { kind: 'discarded', discardReason: 'moldy' },
      { kind: 'consumed', amount: 1.5 },
    ]) {
      const response = await client
        .post(`/api/products/${productId}/outcomes`)
        .headers({ cookie })
        .json(body)
      response.assertStatus(422)
    }

    const still = await client.get(`/api/products/${productId}`).headers({ cookie })
    still.assertBodyContains({ product: { quantity: { amount: 6 } } })
  })

  test('DELETE is a correction and writes no outcome', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-delete@example.com')
    const productId = await createYaourts(client, cookie)

    const destroy = await client.delete(`/api/products/${productId}`).headers({ cookie })
    destroy.assertStatus(204)

    const rows = await db.from('product_outcome').where('product_id', productId)
    assert.lengthOf(rows, 0)
  })

  test('outcomes/stats: totals + buckets for the requested window', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-stats@example.com')
    const productId = await createYaourts(client, cookie)

    await client
      .post(`/api/products/${productId}/outcomes`)
      .headers({ cookie })
      .json({ kind: 'discarded', discardReason: 'spoiled' })

    const response = await client.get('/api/products/outcomes/stats?days=30').headers({ cookie })
    response.assertStatus(200)
    const { stats } = response.body()
    assert.equal(stats.discarded.count, 1)
    assert.equal(stats.discarded.value, 3)
    assert.equal(stats.consumed.count, 0)
    assert.equal(stats.recipeSharePercent, 0)
    assert.lengthOf(stats.buckets, 6)
    assert.equal(
      stats.buckets.reduce(
        (sum: number, b: { discardedCount: number }) => sum + b.discardedCount,
        0,
      ),
      1,
    )
  })

  test('outcomes/stats: without days, defaults to "since the first outcome"', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-stats-all@example.com')

    const noOutcomesYet = await client.get('/api/products/outcomes/stats').headers({ cookie })
    noOutcomesYet.assertStatus(200)
    assert.equal(noOutcomesYet.body().stats.discarded.count, 0)

    const productId = await createYaourts(client, cookie)
    await client
      .post(`/api/products/${productId}/outcomes`)
      .headers({ cookie })
      .json({ kind: 'consumed' })

    const response = await client.get('/api/products/outcomes/stats').headers({ cookie })
    response.assertStatus(200)
    assert.equal(response.body().stats.consumed.count, 1)
  })

  test('outcomes/stats: an invalid days value is 422', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-stats-invalid@example.com')
    const response = await client.get('/api/products/outcomes/stats?days=-1').headers({ cookie })
    response.assertStatus(422)
  })

  test('all product routes require a household', async ({ client }) => {
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'fridge-no-household@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Test',
    })
    const cookie = signUp.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')

    const response = await client.get('/api/products').headers({ cookie })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'no_household' } })
  })
})
