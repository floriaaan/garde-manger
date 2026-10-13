import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidShoppingItemRepository } from '#infrastructure/database/shopping-list/shopping-item.repository'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'

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

function buildItem(id: string, householdId: string, source = 'manual') {
  const quantity = Quantity.create(1, 'kg')
  const sourceVo = ShoppingItemSource.create(source)
  if (!quantity.ok || !sourceVo.ok) throw new Error('unreachable')

  return ShoppingItem.create({
    id,
    householdId,
    name: 'Farine',
    quantity: quantity.value,
    source: sourceVo.value,
    createdAt: new Date(),
  })
}

test.group('LucidShoppingItemRepository', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById() round-trips an item', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidShoppingItemRepository()
    await repository.save(buildItem('s_1', 'h_1'))

    const found = await repository.findById('s_1')
    assert.equal(found?.name, 'Farine')
    assert.equal(found?.quantity.amount, 1)
    assert.isFalse(found?.checked)
  })

  test('findByHousehold() scopes to the household', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createHousehold('h_2', 'u_2')
    await createUser('u_3', 'owner3@example.com')
    await createHousehold('h_3', 'u_3')

    const repository = new LucidShoppingItemRepository()
    await repository.save(buildItem('s_2', 'h_2'))
    await repository.save(buildItem('s_3', 'h_3'))

    const items = await repository.findByHousehold('h_2')
    assert.lengthOf(items, 1)
    assert.equal(items[0]?.id, 's_2')
  })

  test('delete() removes the row', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    await createHousehold('h_4', 'u_4')

    const repository = new LucidShoppingItemRepository()
    await repository.save(buildItem('s_4', 'h_4'))
    await repository.delete('s_4')

    assert.isNull(await repository.findById('s_4'))
  })

  test('save() persists haUid/haSyncedAt, and clearHomeAssistantSync() wipes them', async ({
    assert,
  }) => {
    await createUser('u_5', 'owner5@example.com')
    await createHousehold('h_5', 'u_5')

    const repository = new LucidShoppingItemRepository()
    const item = buildItem('s_5', 'h_5')
    item.markSynced('ha-uid-1', new Date())
    await repository.save(item)

    const reread = await repository.findById(item.id)
    assert.equal(reread?.haUid, 'ha-uid-1')
    assert.isNotNull(reread?.haSyncedAt)

    await repository.clearHomeAssistantSync(item.householdId)
    const cleared = await repository.findById(item.id)
    assert.isNull(cleared?.haUid)
    assert.isNull(cleared?.haSyncedAt)
  })

  test('conditional writes reject stale versions and never recreate deleted rows', async ({
    assert,
  }) => {
    await createUser('u_sync', 'sync@example.com')
    await createHousehold('h_sync', 'u_sync')
    const repository = new LucidShoppingItemRepository()
    await repository.save(buildItem('sync_1', 'h_sync'))
    const first = (await repository.findById('sync_1'))!
    const stale = (await repository.findById('sync_1'))!
    const version = first.updatedAt
    first.update({ name: 'First edit' }, new Date(version.getTime() + 1))
    assert.isTrue(await repository.saveIfUnchanged(first, version))
    stale.update({ name: 'Stale edit' }, new Date(version.getTime() + 2))
    assert.isFalse(await repository.saveIfUnchanged(stale, version))
    const saved = await repository.findById('sync_1')
    assert.equal(saved?.name, 'First edit')
    assert.equal(saved?.updatedAt.getTime(), version.getTime() + 1)
    await repository.delete('sync_1')
    assert.isFalse(await repository.saveIfUnchanged(first, first.updatedAt))
    assert.isNull(await repository.findById('sync_1'))
  })
})
