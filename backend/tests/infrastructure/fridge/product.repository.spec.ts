import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidProductRepository } from '#infrastructure/database/fridge/product.repository'
import { Product } from '#domain/fridge/product.entity'
import type { Product as ProductEntity } from '#domain/fridge/product.entity'
import { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'

async function createUser(id: string, email: string) {
  await db.table('user').insert({
    id,
    name: email,
    email,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

async function createHousehold(id: string, ownerId: string) {
  await db.table('household').insert({
    id,
    name: 'Test household',
    owner_id: ownerId,
    invite_code: id.slice(0, 8).toUpperCase().padEnd(8, '0'),
    created_at: new Date(),
    updated_at: new Date(),
  })
}

function buildProduct(
  id: string,
  householdId: string,
  overrides: Partial<{
    location: string
    expiresAt: Date | null
    amount: number
    price: number | null
  }> = {},
) {
  const quantity = Quantity.create(overrides.amount ?? 1, 'L')
  const location = Location.create(overrides.location ?? 'fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')

  return Product.create({
    id,
    householdId,
    name: 'Lait',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    expiresAt: overrides.expiresAt ?? null,
    price: overrides.price ?? null,
    createdAt: new Date(),
  })
}

function outcomeFor(product: ProductEntity, amount: number, recordedBy: string, id = 'o_1') {
  const at = new Date('2026-09-13T18:00:00Z')
  const takeOut = product.takeOut(amount, at)
  if (!takeOut.ok) throw new Error('unreachable')
  const outcome = ProductOutcome.fromProduct(product, {
    id,
    kind: OutcomeKind.consumed(),
    discardReason: null,
    recordedBy,
    recipeId: null,
    takeOut: takeOut.value,
    at,
  })
  return { outcome, remaining: takeOut.value.remaining }
}

test.group('LucidProductRepository', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById() round-trips a product', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_1', 'h_1'))

    const found = await repository.findById('p_1')
    assert.equal(found?.name, 'Lait')
    assert.equal(found?.quantity.amount, 1)
    assert.equal(found?.location.value, 'fridge')
  })

  test('findByHousehold() filters by location', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createHousehold('h_2', 'u_2')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_2', 'h_2', { location: 'fridge' }))
    await repository.save(buildProduct('p_3', 'h_2', { location: 'pantry' }))

    const fridgeOnly = await repository.findByHousehold('h_2', { location: 'fridge' })
    assert.lengthOf(fridgeOnly, 1)
    assert.equal(fridgeOnly[0]?.id, 'p_2')
  })

  test('findExpiringSoon() only returns products within the window', async ({ assert }) => {
    await createUser('u_3', 'owner3@example.com')
    await createHousehold('h_3', 'u_3')

    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_4', 'h_3', { expiresAt: past }))
    await repository.save(buildProduct('p_5', 'h_3', { expiresAt: soon }))
    await repository.save(buildProduct('p_6', 'h_3', { expiresAt: far }))

    const expiring = await repository.findExpiringSoon('h_3', 3)
    assert.lengthOf(expiring, 1)
    assert.equal(expiring[0]?.id, 'p_5')
  })

  test('daily digest uses calendar dates and current stock after a correction or removal', async ({ assert }) => {
    await createUser('u_digest', 'digest@example.com')
    await createHousehold('h_digest', 'u_digest')
    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_digest', 'h_digest', { expiresAt: new Date('2026-09-20T00:00:00Z') }))

    assert.deepEqual((await repository.findExpiringForDigest('h_digest', '2026-09-20', 0)).map((p) => p.id), ['p_digest'])
    await repository.save(buildProduct('p_digest', 'h_digest', { expiresAt: new Date('2026-09-28T00:00:00Z') }))
    assert.lengthOf(await repository.findExpiringForDigest('h_digest', '2026-09-20', 7), 0)
    const product = buildProduct('p_digest', 'h_digest', { expiresAt: new Date('2026-09-27T00:00:00Z') })
    await repository.save(product)
    assert.lengthOf(await repository.findExpiringForDigest('h_digest', '2026-09-20', 7), 1)
    const { outcome, remaining } = outcomeFor(product, 1, 'u_digest', 'o_digest')
    await repository.recordOutcome(outcome, remaining)
    assert.lengthOf(await repository.findExpiringForDigest('h_digest', '2026-09-20', 7), 0)
  })

  test('delete() removes the row', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    await createHousehold('h_4', 'u_4')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_7', 'h_4'))
    await repository.delete('p_7')

    assert.isNull(await repository.findById('p_7'))
  })

  test('save() round-trips initialQuantity', async ({ assert }) => {
    await createUser('u_5', 'owner5@example.com')
    await createHousehold('h_5', 'u_5')
    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_8', 'h_5', { amount: 6 }))

    const found = await repository.findById('p_8')
    assert.equal(found?.initialQuantity, 6)
  })

  test('recordOutcome() of the whole stock deletes the product and writes the log row', async ({
    assert,
  }) => {
    await createUser('u_6', 'owner6@example.com')
    await createHousehold('h_6', 'u_6')
    const repository = new LucidProductRepository()
    const product = buildProduct('p_9', 'h_6', { amount: 2, price: 3 })
    await repository.save(product)

    const { outcome, remaining } = outcomeFor(product, 2, 'u_6')
    await repository.recordOutcome(outcome, remaining)

    assert.isNull(await repository.findById('p_9'))
    const rows = await db.from('product_outcome').where('product_id', 'p_9')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].kind, 'consumed')
    assert.equal(rows[0].amount, 2)
    assert.equal(Number(rows[0].price), 3)
    assert.equal(rows[0].product_name, 'Lait')
  })

  test('recordOutcome() of part of the stock decrements the product and writes the log row', async ({
    assert,
  }) => {
    await createUser('u_7', 'owner7@example.com')
    await createHousehold('h_7', 'u_7')
    const repository = new LucidProductRepository()
    const product = buildProduct('p_10', 'h_7', { amount: 6, price: 3 })
    await repository.save(product)

    const { outcome, remaining } = outcomeFor(product, 2, 'u_7')
    await repository.recordOutcome(outcome, remaining)

    const found = await repository.findById('p_10')
    assert.equal(found?.quantity.amount, 4)
    assert.equal(found?.initialQuantity, 6)
    const rows = await db.from('product_outcome').where('product_id', 'p_10')
    assert.equal(Number(rows[0].price), 1)
  })

  test('recordOutcome() leaves the stock untouched when the log row cannot be written', async ({
    assert,
  }) => {
    await createUser('u_8', 'owner8@example.com')
    await createHousehold('h_8', 'u_8')
    const repository = new LucidProductRepository()
    const product = buildProduct('p_11', 'h_8', { amount: 2 })
    await repository.save(product)

    // An unknown member id violates `recorded_by`'s foreign key — after the
    // product row has already been deleted inside the transaction.
    const at = new Date('2026-09-13T18:00:00Z')
    const takeOut = product.takeOut(2, at)
    if (!takeOut.ok) throw new Error('unreachable')
    const outcome = ProductOutcome.fromProduct(product, {
      id: 'o_2',
      kind: OutcomeKind.consumed(),
      discardReason: null,
      recordedBy: 'u_missing',
      recipeId: null,
      takeOut: takeOut.value,
      at,
    })

    await assert.rejects(() => repository.recordOutcome(outcome, takeOut.value.remaining))
    assert.isNotNull(await repository.findById('p_11'))
  })
})
