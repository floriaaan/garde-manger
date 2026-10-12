import { test } from '@japa/runner'
import { UpdateProduct } from '#application/fridge/update-product.use-case'
import { FakeProductRepository, buildProduct, FIXED_CLOCK } from './fakes.js'

test.group('UpdateProduct concurrency', () => {
  test('the first accepted quantity wins; stale device intent is rejected', async ({ assert }) => {
    const repository = new FakeProductRepository()
    const entity = buildProduct()
    await repository.save(entity)
    const useCase = new UpdateProduct(repository, FIXED_CLOCK)
    const expectedUpdatedAt = entity.updatedAt
    const input = { householdId: 'h_1', productId: entity.id, expectedUpdatedAt }
    assert.isTrue((await useCase.execute({ ...input, quantity: { amount: 2, unit: 'L' } })).ok)
    const stale = await useCase.execute({ ...input, quantity: { amount: 3, unit: 'L' } })
    assert.deepEqual(stale, { ok: false, error: 'sync_conflict' })
    assert.equal((await repository.findById(entity.id))?.quantity.amount, 2)
  })

  test('deletion between read and write returns a conflict without inserting', async ({ assert }) => {
    const repository = new FakeProductRepository()
    const entity = buildProduct()
    await repository.save(entity)
    const original = repository.saveIfUnchanged.bind(repository)
    repository.saveIfUnchanged = async (changed, version) => {
      await repository.delete(changed.id)
      return original(changed, version)
    }
    const result = await new UpdateProduct(repository, FIXED_CLOCK).execute({
      householdId: 'h_1', productId: entity.id, name: 'Changed',
    })
    assert.deepEqual(result, { ok: false, error: 'sync_conflict' })
    assert.isNull(await repository.findById(entity.id))
  })
})
