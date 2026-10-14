import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { FakeProductRepository, buildProduct } from '#tests/unit/application/fridge/fakes'

test.group('Use case provider bindings', () => {
  test('uses the request repository without leaking it into another request', async ({ assert }) => {
    const first = app.container.createResolver()
    const second = app.container.createResolver()
    const firstProducts = new FakeProductRepository()
    const secondProducts = new FakeProductRepository()
    await firstProducts.save(buildProduct({ id: 'first' }))
    await secondProducts.save(buildProduct({ id: 'second' }))
    first.bindValue('fridge.products', firstProducts)
    second.bindValue('fridge.products', secondProducts)

    const firstList = await first.make('fridge.listProducts')
    const secondList = await second.make('fridge.listProducts')

    assert.deepEqual((await firstList.execute({ householdId: 'h_1' })).map((p) => p.id), ['first'])
    assert.deepEqual((await secondList.execute({ householdId: 'h_1' })).map((p) => p.id), ['second'])
  })

  test('resolves AI generation for each household instead of capturing the first one', async ({
    assert,
  }) => {
    const resolver = app.container.createResolver()
    resolver.bindValue('fridge.products', new FakeProductRepository())
    const resolved: string[] = []
    const executed: string[] = []
    resolver.bindValue('settings.resolveRecipeGenerationPort', async (householdId) => {
      const id = householdId ?? 'none'
      resolved.push(id)
      return {
        async generate() {
          executed.push(id)
          return []
        },
      }
    })

    const create = await resolver.make('recipe.createSuggestRecipes')
    const first = await create('h_1')
    const second = await create('h_2')
    await second.execute({ householdId: 'h_2' })
    await first.execute({ householdId: 'h_1' })

    assert.deepEqual(resolved, ['h_1', 'h_2'])
    assert.deepEqual(executed, ['h_2', 'h_1'])
  })
})
