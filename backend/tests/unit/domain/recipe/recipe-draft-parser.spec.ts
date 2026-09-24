import { test } from '@japa/runner'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationParseError } from '#domain/recipe/recipe-generation.errors'

const VALID_JSON = JSON.stringify([
  {
    title: 'Gratin de courgettes',
    description: null,
    instructions: 'Couper, cuire, gratiner.',
    preparationTime: 30,
    tags: ['végétarien'],
    ingredients: [{ label: 'Courgette', quantity: 2, unit: 'piece' }],
  },
])

test.group('parseRecipeDraftsJson', () => {
  test('parses a well-formed AI response', ({ assert }) => {
    const drafts = parseRecipeDraftsJson(VALID_JSON)
    assert.lengthOf(drafts, 1)
    assert.equal(drafts[0]?.title, 'Gratin de courgettes')
    assert.lengthOf(drafts[0]?.ingredients ?? [], 1)
    assert.isNull(drafts[0]?.ingredients[0]?.productId)
  })

  test('rounds a fractional ingredient quantity', ({ assert }) => {
    const json = JSON.stringify([
      {
        title: 'Soupe',
        description: null,
        instructions: 'Mixer.',
        preparationTime: null,
        tags: [],
        ingredients: [{ label: 'Carotte', quantity: 2.6, unit: 'piece' }],
      },
    ])
    const drafts = parseRecipeDraftsJson(json)
    assert.equal(drafts[0]?.ingredients[0]?.quantity, 3)
  })

  test('strips a ```json fenced code block some models wrap the response in', ({ assert }) => {
    const drafts = parseRecipeDraftsJson(`Voici le résultat:\n\`\`\`json\n${VALID_JSON}\n\`\`\``)
    assert.equal(drafts[0]?.title, 'Gratin de courgettes')
  })

  test('throws RecipeGenerationParseError on invalid JSON', ({ assert }) => {
    assert.throws(() => parseRecipeDraftsJson('not json'), RecipeGenerationParseError)
  })

  test('throws RecipeGenerationParseError when the response is not an array', ({ assert }) => {
    assert.throws(
      () => parseRecipeDraftsJson(JSON.stringify({ title: 'X' })),
      RecipeGenerationParseError,
    )
  })

  test('throws RecipeGenerationParseError on an empty array', ({ assert }) => {
    assert.throws(() => parseRecipeDraftsJson('[]'), RecipeGenerationParseError)
  })

  test('rejects a recipe whose fields are present but empty — a failed generation, not a recipe', ({
    assert,
  }) => {
    const blank = JSON.stringify([
      { title: '  ', description: null, instructions: '', preparationTime: null, tags: [], ingredients: [] },
    ])
    assert.throws(() => parseRecipeDraftsJson(blank), RecipeGenerationParseError)
  })

  test('rejects a recipe with no ingredients', ({ assert }) => {
    const noIngredients = JSON.stringify([
      {
        title: 'Soupe',
        description: null,
        instructions: 'Mixer.',
        preparationTime: null,
        tags: [],
        ingredients: [],
      },
    ])
    assert.throws(() => parseRecipeDraftsJson(noIngredients), RecipeGenerationParseError)
  })

  test('rejects an ingredient whose label is blank', ({ assert }) => {
    const blankLabel = JSON.stringify([
      {
        title: 'Soupe',
        description: null,
        instructions: 'Mixer.',
        preparationTime: null,
        tags: [],
        ingredients: [{ label: '   ', quantity: 1, unit: null }],
      },
    ])
    assert.throws(() => parseRecipeDraftsJson(blankLabel), RecipeGenerationParseError)
  })

  test('throws RecipeGenerationParseError when a recipe is missing required fields', ({
    assert,
  }) => {
    assert.throws(
      () => parseRecipeDraftsJson(JSON.stringify([{ title: 'X' }])),
      RecipeGenerationParseError,
    )
  })
})
