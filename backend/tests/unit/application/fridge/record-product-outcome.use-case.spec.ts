import { test } from '@japa/runner'
import { RecordProductOutcome } from '#application/fridge/record-product-outcome.use-case'
import { FakeProductRepository, buildProduct, FIXED_CLOCK, SEQUENTIAL_IDS } from './fakes.js'

async function setup(product = buildProduct()) {
  const products = new FakeProductRepository()
  await products.save(product)
  const useCase = new RecordProductOutcome(products, SEQUENTIAL_IDS('outcome'), FIXED_CLOCK)
  return { products, useCase }
}

const BASE = { householdId: 'h_1', userId: 'u_1', productId: 'p_1' }

test.group('RecordProductOutcome', () => {
  test('a retry after product deletion returns the stored outcome only once', async ({
    assert,
  }) => {
    const { products, useCase } = await setup()
    const input = { ...BASE, kind: 'consumed', amount: 6, operationId: 'same-operation' }
    const first = await useCase.execute(input)
    const retry = await useCase.execute(input)
    assert.deepEqual(retry, first)
    assert.lengthOf(products.outcomes, 1)
    assert.isNull(await products.findById('p_1'))
  })

  test('partial-consumption retries never subtract stock twice', async ({ assert }) => {
    const { products, useCase } = await setup()
    const input = { ...BASE, kind: 'consumed', amount: 1, operationId: 'partial-operation' }
    await useCase.execute(input)
    await useCase.execute(input)
    const remaining = await products.findById('p_1')
    assert.equal(remaining?.quantity.amount, 5)
    assert.lengthOf(products.outcomes, 1)
  })

  test('reusing an operation for another amount is refused', async ({ assert }) => {
    const { products, useCase } = await setup()
    const input = { ...BASE, kind: 'consumed', amount: 1, operationId: 'fixed-intent' }
    await useCase.execute(input)
    const changed = await useCase.execute({ ...input, amount: 2 })
    assert.isFalse(changed.ok)
    assert.lengthOf(products.outcomes, 1)
    const remaining = await products.findById('p_1')
    assert.equal(remaining?.quantity.amount, 5)
  })

  test('an operation receipt cannot be replayed by another actor or household', async ({
    assert,
  }) => {
    const { products, useCase } = await setup()
    const input = { ...BASE, kind: 'consumed', amount: 6, operationId: 'private-receipt' }
    await useCase.execute(input)
    assert.deepEqual(await useCase.execute({ ...input, userId: 'another-user' }), {
      ok: false,
      error: 'product_not_found',
    })
    assert.deepEqual(await useCase.execute({ ...input, householdId: 'another-household' }), {
      ok: false,
      error: 'product_not_found',
    })
    assert.lengthOf(products.outcomes, 1)
  })

  test('without an amount, the whole stock leaves and the product is gone', async ({ assert }) => {
    const { products, useCase } = await setup()
    const result = await useCase.execute({ ...BASE, kind: 'consumed' })

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isNull(result.value.product)
    assert.equal(result.value.outcome.quantity.amount, 6)
    assert.equal(result.value.outcome.recordedBy, 'u_1')
    assert.isNull(await products.findById('p_1'))
    assert.lengthOf(products.outcomes, 1)
  })

  test('a partial discard keeps the rest in the garde-manger, with its reason', async ({
    assert,
  }) => {
    const { products, useCase } = await setup()
    const result = await useCase.execute({
      ...BASE,
      kind: 'discarded',
      amount: 2,
      discardReason: 'spoiled',
    })

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.equal(result.value.product?.quantity.amount, 4)
    assert.equal(result.value.outcome.discardReason?.value, 'spoiled')
    assert.equal(result.value.outcome.price, 1)
    assert.equal(result.value.outcome.occurredAt.toISOString(), FIXED_CLOCK.now().toISOString())
    const stored = await products.findById('p_1')
    assert.equal(stored?.quantity.amount, 4)
  })

  test('another household product is not found', async ({ assert }) => {
    const { products, useCase } = await setup(buildProduct({ householdId: 'h_other' }))
    const result = await useCase.execute({ ...BASE, kind: 'consumed' })

    assert.deepEqual(result, { ok: false, error: 'product_not_found' })
    assert.lengthOf(products.outcomes, 0)
  })

  test('a reason on a consumed product is refused and nothing is written', async ({ assert }) => {
    const { products, useCase } = await setup()
    const result = await useCase.execute({ ...BASE, kind: 'consumed', discardReason: 'expired' })

    assert.isFalse(result.ok)
    if (!result.ok) assert.deepInclude(result.error, { field: 'discardReason' })
    const untouched = await products.findById('p_1')
    assert.equal(untouched?.quantity.amount, 6)
    assert.lengthOf(products.outcomes, 0)
  })

  test('more than the stock is refused and nothing is written', async ({ assert }) => {
    const { products, useCase } = await setup()
    const result = await useCase.execute({ ...BASE, kind: 'discarded', amount: 7 })

    assert.isFalse(result.ok)
    const stillIntact = await products.findById('p_1')
    assert.equal(stillIntact?.quantity.amount, 6)
    assert.lengthOf(products.outcomes, 0)
  })
})
