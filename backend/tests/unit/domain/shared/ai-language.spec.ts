import { test } from '@japa/runner'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { buildReceiptExtractionPrompt } from '#domain/receipt/receipt-extraction-prompt'
import { buildFridgeScanExtractionPrompt } from '#domain/fridge/fridge-scan-extraction-prompt'

test.group('AI output language', () => {
  for (const language of ['fr', 'en'] as const) {
    test(`recipes and scans request ${language} regardless of source language`, ({ assert }) => {
      const recipe = buildRecipeGenerationPrompt({
        products: [{ name: 'Lait', category: 'Produits laitiers', expiresAt: null }],
        prompt: 'Réponds en français',
        prioritizeExpiringSoon: false,
        language,
      })
      const receipt = buildReceiptExtractionPrompt(language)
      const fridge = buildFridgeScanExtractionPrompt(language)
      for (const prompt of [recipe, receipt, fridge]) {
        assert.include(prompt, `Output language: ${language === 'en' ? 'English' : 'French'}.`)
        assert.include(prompt, 'Read and understand source material in any language.')
        assert.include(prompt, 'Preserve proper names (brands, stores), JSON keys, enum values')
      }
      assert.include(recipe, 'title, description, instructions, tags, ingredient labels')
      assert.include(recipe, 'Réponds en français')
      assert.isAbove(recipe.indexOf('Output language:'), recipe.indexOf('Réponds en français'))
      for (const prompt of [receipt, fridge]) {
        assert.include(prompt, 'item names, categories and spelled-out units')
      }
      assert.include(fridge, '"fridge" | "freezer" | "pantry"')
    })
  }

  test('old clients and jobs retain French by default', ({ assert }) => {
    const recipe = buildRecipeGenerationPrompt({ products: [], prioritizeExpiringSoon: false })
    for (const prompt of [recipe, buildReceiptExtractionPrompt(), buildFridgeScanExtractionPrompt()]) {
      assert.include(prompt, 'Output language: French.')
    }
  })
})
