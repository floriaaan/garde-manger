import { test } from '@japa/runner'
import { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import { FakeShoppingItemRepository, FIXED_CLOCK, SEQUENTIAL_IDS } from './fakes.js'

function setup() {
  const items = new FakeShoppingItemRepository()
  const useCase = new CreateShoppingItem(items, SEQUENTIAL_IDS('item'), FIXED_CLOCK)
  return { items, useCase }
}

test.group('CreateShoppingItem', () => {
  test('restocking refuses a silent duplicate, even when units differ', async ({ assert }) => {
    const { items, useCase } = setup()
    await useCase.execute({
      householdId: 'h1',
      name: 'Lait',
      quantity: { amount: 2, unit: 'L' },
      source: 'manual',
    })
    const result = await useCase.execute({
      householdId: 'h1',
      name: ' LAIT ',
      quantity: { amount: 1, unit: 'bouteille' },
      source: 'manual',
      onDuplicate: 'reject',
    })
    assert.deepEqual(result, { ok: false, error: 'shopping_item_exists' })
    const all = await items.findByHousehold('h1')
    assert.lengthOf(all, 1)
    assert.equal(all[0]?.quantity.amount, 2)
  })

  test('explicit keep and replace are safe to repeat and replace the total', async ({ assert }) => {
    const { items, useCase } = setup()
    const first = await useCase.execute({
      householdId: 'h1',
      name: 'Lait',
      quantity: { amount: 2, unit: 'L' },
      source: 'manual',
    })
    if (!first.ok) throw new Error('bad fixture')
    const input = {
      householdId: 'h1',
      name: 'Lait',
      quantity: { amount: 3, unit: 'bouteilles' },
      source: 'manual',
      existingItemId: first.value.item.id,
    }
    const keep = await useCase.execute({ ...input, onDuplicate: 'keep' })
    assert.isTrue(keep.ok)
    assert.equal(first.value.item.quantity.amount, 2)
    assert.equal(first.value.item.quantity.unit, 'L')
    await useCase.execute({ ...input, onDuplicate: 'replace' })
    await useCase.execute({ ...input, onDuplicate: 'replace' })
    const all = await items.findByHousehold('h1')
    assert.lengthOf(all, 1)
    assert.equal(all[0]?.quantity.amount, 3)
    assert.equal(all[0]?.quantity.unit, 'bouteilles')
  })

  test('a changed or cross-household target cannot be silently replaced', async ({ assert }) => {
    const { items, useCase } = setup()
    const first = await useCase.execute({
      householdId: 'h1',
      name: 'Lait',
      quantity: { amount: 2, unit: 'L' },
      source: 'manual',
    })
    if (!first.ok) throw new Error('bad fixture')
    const input = {
      householdId: 'h2',
      name: 'Lait',
      quantity: { amount: 3, unit: 'L' },
      source: 'manual',
      existingItemId: first.value.item.id,
      onDuplicate: 'replace' as const,
    }
    assert.deepEqual(await useCase.execute(input), { ok: false, error: 'shopping_item_changed' })
    await items.delete(first.value.item.id)
    assert.deepEqual(await useCase.execute({ ...input, householdId: 'h1' }), {
      ok: false,
      error: 'shopping_item_changed',
    })
    assert.lengthOf(await items.findByHousehold('h1'), 0)
  })

  test('create and duplicate decision execute inside the repository household lock', async ({
    assert,
  }) => {
    const { items, useCase } = setup()
    let lockedHousehold: string | undefined
    const repository: ShoppingItemRepository = items
    repository.withHouseholdLock = async (householdId, action) => {
      lockedHousehold = householdId
      return action(items)
    }
    await useCase.execute({
      householdId: 'h1',
      name: 'Lait',
      quantity: { amount: 1, unit: 'L' },
      source: 'manual',
      onDuplicate: 'reject',
    })
    assert.equal(lockedHousehold, 'h1')
    assert.lengthOf(await items.findByHousehold('h1'), 1)
  })

  test('no existing item with that name: creates a new one', async ({ assert }) => {
    const { items, useCase } = setup()
    const result = await useCase.execute({
      householdId: 'h1',
      name: 'Farine',
      quantity: { amount: 1, unit: 'kg' },
      source: 'manual',
    })
    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isTrue(result.value.created)
    const all = await items.findByHousehold('h1')
    assert.equal(all.length, 1)
  })

  test('same name (accents/case/whitespace folded), same unit: merges instead of duplicating', async ({
    assert,
  }) => {
    const { items, useCase } = setup()
    await useCase.execute({
      householdId: 'h1',
      name: '  Épinards  ',
      quantity: { amount: 1, unit: 'kg' },
      source: 'manual',
    })

    const result = await useCase.execute({
      householdId: 'h1',
      name: 'epinards',
      quantity: { amount: 2, unit: 'kg' },
      source: 'recipe',
    })

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isFalse(result.value.created)
    assert.equal(result.value.item.quantity.amount, 3)

    const all = await items.findByHousehold('h1')
    assert.equal(all.length, 1)
  })

  test('same name, convertible units: merges into the finer unit', async ({ assert }) => {
    const { items, useCase } = setup()
    await useCase.execute({
      householdId: 'h1',
      name: 'Farine',
      quantity: { amount: 300, unit: 'g' },
      source: 'manual',
    })
    const result = await useCase.execute({
      householdId: 'h1',
      name: 'Farine',
      quantity: { amount: 1, unit: 'kg' },
      source: 'recipe',
    })
    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isFalse(result.value.created)
    assert.equal(result.value.item.quantity.amount, 1300)
    assert.equal(result.value.item.quantity.unit, 'g')
    const all = await items.findByHousehold('h1')
    assert.equal(all.length, 1)
  })

  test('same name, incompatible units: does not merge, creates a separate line', async ({
    assert,
  }) => {
    const { items, useCase } = setup()
    await useCase.execute({
      householdId: 'h1',
      name: 'Farine',
      quantity: { amount: 1, unit: 'unité' },
      source: 'manual',
    })
    const result = await useCase.execute({
      householdId: 'h1',
      name: 'Farine',
      quantity: { amount: 1, unit: 'kg' },
      source: 'manual',
    })
    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isTrue(result.value.created)
    const all = await items.findByHousehold('h1')
    assert.equal(all.length, 2)
  })

  test('a checked item with the same name is a closed instance: does not merge', async ({
    assert,
  }) => {
    const { items, useCase } = setup()
    const first = await useCase.execute({
      householdId: 'h1',
      name: 'Farine',
      quantity: { amount: 1, unit: 'kg' },
      source: 'manual',
    })
    if (!first.ok) throw new Error('bad fixture')
    first.value.item.toggle(new Date())
    await items.save(first.value.item)

    const result = await useCase.execute({
      householdId: 'h1',
      name: 'Farine',
      quantity: { amount: 1, unit: 'kg' },
      source: 'manual',
    })
    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isTrue(result.value.created)
    const all = await items.findByHousehold('h1')
    assert.equal(all.length, 2)
  })

  test('same name in a different household: never merges across households', async ({ assert }) => {
    const { items, useCase } = setup()
    await useCase.execute({
      householdId: 'h1',
      name: 'Farine',
      quantity: { amount: 1, unit: 'kg' },
      source: 'manual',
    })
    const result = await useCase.execute({
      householdId: 'h2',
      name: 'Farine',
      quantity: { amount: 1, unit: 'kg' },
      source: 'manual',
    })
    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isTrue(result.value.created)
    const inH1 = await items.findByHousehold('h1')
    const inH2 = await items.findByHousehold('h2')
    assert.equal(inH1.length, 1)
    assert.equal(inH2.length, 1)
  })
})
