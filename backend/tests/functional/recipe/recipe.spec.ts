import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { __setRecipeGenerationOverrideForTests } from '#infrastructure/settings/ai-provider-registry'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'

const fakeDrafts = [
  {
    title: 'Gratin de courgettes',
    description: null,
    instructions: 'Couper, cuire, gratiner.',
    preparationTime: 30,
    tags: ['végétarien'],
    ingredients: [{ label: 'Courgette', productId: null, quantity: 2, unit: 'piece' }],
  },
]

const fakeGeneration: RecipeGenerationPort = {
  async generate() {
    return fakeDrafts
  },
}

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer recettes' })
  return cookie
}

test.group('recipe: suggestions, save, list, detail, delete', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  group.each.setup(() => {
    __setRecipeGenerationOverrideForTests(fakeGeneration)
    return () => __setRecipeGenerationOverrideForTests(null)
  })

  test('suggestions does not persist', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-suggestions@example.com')
    const response = await client.get('/api/recipes/suggestions').headers({ cookie })
    response.assertStatus(200)
    assert.lengthOf(response.body().recipes, 1)

    const list = await client.get('/api/recipes').headers({ cookie })
    assert.lengthOf(list.body().recipes, 0)
  })

  test('save persists a manual recipe, detail and delete work', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-save@example.com')

    const save = await client
      .post('/api/recipes')
      .headers({ cookie })
      .json({
        title: 'Salade de tomates',
        source: 'user',
        instructions: 'Couper, assaisonner.',
        ingredients: [{ label: 'Tomate', quantity: 3, unit: 'piece' }],
      })
    save.assertStatus(201)
    const recipeId = save.body().recipe.id

    const detail = await client.get(`/api/recipes/${recipeId}`).headers({ cookie })
    detail.assertBodyContains({ recipe: { title: 'Salade de tomates', source: 'user' } })
    assert.lengthOf(detail.body().recipe.ingredients, 1)

    const destroy = await client.delete(`/api/recipes/${recipeId}`).headers({ cookie })
    destroy.assertStatus(204)

    const afterDelete = await client.get(`/api/recipes/${recipeId}`).headers({ cookie })
    afterDelete.assertStatus(404)
  })

  test('a recipe records who wrote it into the library', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-author@example.com')

    const save = await client
      .post('/api/recipes')
      .headers({ cookie })
      .json({
        title: 'Salade de tomates',
        source: 'user',
        instructions: 'Couper, assaisonner.',
        ingredients: [{ label: 'Tomate', quantity: 3, unit: 'piece' }],
      })
    save.assertStatus(201)

    // The library is shared, so a row that names nobody is a row four people
    // cannot tell apart.
    assert.isString(save.body().recipe.createdBy)
    assert.equal(save.body().recipe.cookCount, 0)
    assert.isNull(save.body().recipe.lastCookedAt)
  })

  test('cooking a recipe consumes its products and is counted', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-cooked@example.com')

    const product = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Épinards frais',
        quantity: { amount: 200, unit: 'g' },
        location: 'fridge',
        category: 'Légumes',
      })
    product.assertStatus(201)
    const productId = product.body().product.id

    const save = await client
      .post('/api/recipes')
      .headers({ cookie })
      .json({
        title: 'Poêlée d’épinards',
        source: 'user',
        instructions: 'Faire revenir.',
        ingredients: [{ label: 'Épinards frais', quantity: 200, unit: 'g' }],
      })
    const recipeId = save.body().recipe.id

    const cooked = await client
      .post(`/api/recipes/${recipeId}/cooked`)
      .headers({ cookie })
      .json({ productIds: [productId] })
    cooked.assertStatus(200)
    assert.equal(cooked.body().recipe.cookCount, 1)
    assert.isString(cooked.body().recipe.lastCookedAt)
    assert.isString(cooked.body().recipe.lastCookedBy)

    // The point of the whole action: the spinach is out of the garde-manger,
    // so the dashboard's expiry counts fall for the right reason and "Ce soir"
    // stops recommending the same dish for the same product tomorrow.
    const gone = await client.get(`/api/products/${productId}`).headers({ cookie })
    gone.assertStatus(404)

    const outcomes = await db.from('product_outcome').where('product_id', productId)
    assert.lengthOf(outcomes, 1)
    assert.equal(outcomes[0].kind, 'consumed')
    assert.equal(outcomes[0].recipe_id, recipeId)
    assert.equal(outcomes[0].amount, 200)

    // Twice is twice — the log appends rather than overwriting.
    await client.post(`/api/recipes/${recipeId}/cooked`).headers({ cookie }).json({})
    const detail = await client.get(`/api/recipes/${recipeId}`).headers({ cookie })
    assert.equal(detail.body().recipe.cookCount, 2)
  })

  test('cooking cannot reach into another household fridge', async ({ client, assert }) => {
    const cookieA = await signUpWithHousehold(client, 'recipe-cook-a@example.com')
    const product = await client
      .post('/api/products')
      .headers({ cookie: cookieA })
      .json({
        name: 'Épinards frais',
        quantity: { amount: 200, unit: 'g' },
        location: 'fridge',
        category: 'Légumes',
      })
    const foreignProductId = product.body().product.id

    const cookieB = await signUpWithHousehold(client, 'recipe-cook-b@example.com')
    const save = await client
      .post('/api/recipes')
      .headers({ cookie: cookieB })
      .json({
        title: 'Poêlée',
        source: 'user',
        instructions: 'Cuire.',
        ingredients: [{ label: 'Épinards' }],
      })
    const recipeId = save.body().recipe.id

    // The cook is recorded; the other foyer's fridge is untouched.
    const cooked = await client
      .post(`/api/recipes/${recipeId}/cooked`)
      .headers({ cookie: cookieB })
      .json({ productIds: [foreignProductId] })
    cooked.assertStatus(200)
    assert.equal(cooked.body().recipe.cookCount, 1)

    const survivor = await client
      .get(`/api/products/${foreignProductId}`)
      .headers({ cookie: cookieA })
    survivor.assertStatus(200)
  })

  test('cooking a recipe from another household returns 404, not a leak', async ({ client }) => {
    const cookieA = await signUpWithHousehold(client, 'recipe-cook-leak-a@example.com')
    const save = await client
      .post('/api/recipes')
      .headers({ cookie: cookieA })
      .json({
        title: 'Salade',
        source: 'user',
        instructions: 'Couper.',
        ingredients: [{ label: 'Tomate' }],
      })
    const recipeId = save.body().recipe.id

    const cookieB = await signUpWithHousehold(client, 'recipe-cook-leak-b@example.com')
    const cooked = await client
      .post(`/api/recipes/${recipeId}/cooked`)
      .headers({ cookie: cookieB })
      .json({})
    cooked.assertStatus(404)
    cooked.assertBodyContains({ error: { type: 'recipe_not_found' } })
  })

  test('save rejects an unknown source', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-badsource@example.com')
    const response = await client
      .post('/api/recipes')
      .headers({ cookie })
      .json({
        title: 'X',
        source: 'community',
        instructions: 'X',
        ingredients: [{ label: 'X' }],
      })
    response.assertStatus(422)
  })

  test('accessing another household recipe returns 404, not a leak', async ({ client }) => {
    const cookieA = await signUpWithHousehold(client, 'recipe-household-a@example.com')
    const save = await client
      .post('/api/recipes')
      .headers({ cookie: cookieA })
      .json({
        title: 'Salade de tomates',
        source: 'user',
        instructions: 'Couper, assaisonner.',
        ingredients: [{ label: 'Tomate', quantity: 3, unit: 'piece' }],
      })
    save.assertStatus(201)
    const recipeId = save.body().recipe.id

    const cookieB = await signUpWithHousehold(client, 'recipe-household-b@example.com')

    const detail = await client.get(`/api/recipes/${recipeId}`).headers({ cookie: cookieB })
    detail.assertStatus(404)
    detail.assertBodyContains({ error: { type: 'recipe_not_found' } })

    const destroy = await client.delete(`/api/recipes/${recipeId}`).headers({ cookie: cookieB })
    destroy.assertStatus(404)
    destroy.assertBodyContains({ error: { type: 'recipe_not_found' } })
  })

  test('all recipe routes require a household', async ({ client }) => {
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'recipe-no-household@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Test',
    })
    const cookie = signUp.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')

    const response = await client.get('/api/recipes').headers({ cookie })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'no_household' } })
  })
})
