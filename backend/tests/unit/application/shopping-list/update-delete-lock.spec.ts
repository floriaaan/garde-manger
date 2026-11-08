import { test } from '@japa/runner'
import { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'
import { UpdateShoppingItem } from '#application/shopping-list/update-shopping-item.use-case'
import { DeleteShoppingItem } from '#application/shopping-list/delete-shopping-item.use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import { FakeShoppingItemRepository, FIXED_CLOCK, SEQUENTIAL_IDS } from './fakes.js'

test('PATCH and DELETE read and write under the same household lock as restocking', async ({
  assert,
}) => {
  const items = new FakeShoppingItemRepository()
  const created = await new CreateShoppingItem(items, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
    householdId: 'h1',
    name: 'Lait',
    quantity: { amount: 2, unit: 'L' },
    source: 'manual',
  })
  if (!created.ok) throw new Error('bad fixture')
  let locked = false
  let lockCount = 0
  const repository: ShoppingItemRepository = items
  repository.withHouseholdLock = async (householdId, action) => {
    assert.equal(householdId, 'h1')
    locked = true
    lockCount++
    try {
      return await action(items)
    } finally {
      locked = false
    }
  }
  const find = items.findById.bind(items)
  const save = items.save.bind(items)
  const remove = items.delete.bind(items)
  items.findById = async (id) => {
    assert.isTrue(locked)
    return find(id)
  }
  items.save = async (item) => {
    assert.isTrue(locked)
    return save(item)
  }
  items.delete = async (id) => {
    assert.isTrue(locked)
    return remove(id)
  }
  const updated = await new UpdateShoppingItem(items, FIXED_CLOCK).execute({
    householdId: 'h1',
    itemId: created.value.item.id,
    checked: true,
  })
  assert.isTrue(updated.ok)
  const deleted = await new DeleteShoppingItem(items).execute({
    householdId: 'h1',
    itemId: created.value.item.id,
  })
  assert.isTrue(deleted.ok)
  assert.equal(lockCount, 2)
  assert.isNull(await find(created.value.item.id))
})
