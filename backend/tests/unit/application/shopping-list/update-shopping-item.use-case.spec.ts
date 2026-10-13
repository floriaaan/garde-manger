import { test } from '@japa/runner'
import { UpdateShoppingItem } from '#application/shopping-list/update-shopping-item.use-case'
import { FakeShoppingItemRepository, FIXED_CLOCK } from './fakes.js'
import { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'

test.group('UpdateShoppingItem concurrency', () => {
  test('the first accepted quantity wins; stale device intent is rejected', async ({ assert }) => {
    const repository = new FakeShoppingItemRepository()
    const created = await new CreateShoppingItem(
      repository,
      { next: () => 'p_1' },
      FIXED_CLOCK,
    ).execute({
      householdId: 'h_1',
      name: 'Milk',
      quantity: { amount: 1, unit: 'L' },
      source: 'manual',
    })
    if (!created.ok) throw new Error('Invalid fixture')
    const entity = created.value.item
    const useCase = new UpdateShoppingItem(repository, FIXED_CLOCK)
    const expectedUpdatedAt = entity.updatedAt
    const input = { householdId: 'h_1', itemId: entity.id, expectedUpdatedAt }
    const firstResult = await useCase.execute({ ...input, quantity: { amount: 2, unit: 'L' } })
    assert.isTrue(firstResult.ok)
    const stale = await useCase.execute({ ...input, quantity: { amount: 3, unit: 'L' } })
    assert.deepEqual(stale, { ok: false, error: 'sync_conflict' })
    const saved = await repository.findById(entity.id)
    assert.equal(saved?.quantity.amount, 2)
  })

  test('deletion between read and write returns a conflict without inserting', async ({
    assert,
  }) => {
    const repository = new FakeShoppingItemRepository()
    const created = await new CreateShoppingItem(
      repository,
      { next: () => 'p_1' },
      FIXED_CLOCK,
    ).execute({
      householdId: 'h_1',
      name: 'Milk',
      quantity: { amount: 1, unit: 'L' },
      source: 'manual',
    })
    if (!created.ok) throw new Error('Invalid fixture')
    const entity = created.value.item
    const original = repository.saveIfUnchanged.bind(repository)
    repository.saveIfUnchanged = async (changed, version) => {
      await repository.delete(changed.id)
      return original(changed, version)
    }
    const result = await new UpdateShoppingItem(repository, FIXED_CLOCK).execute({
      householdId: 'h_1',
      itemId: entity.id,
      name: 'Changed',
    })
    assert.deepEqual(result, { ok: false, error: 'sync_conflict' })
    assert.isNull(await repository.findById(entity.id))
  })
})
