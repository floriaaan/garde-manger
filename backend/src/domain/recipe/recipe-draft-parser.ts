import type { RecipeDraft, RecipeDraftIngredient } from './recipe-draft.js'
import { RecipeGenerationParseError } from './recipe-generation.errors.js'

interface RawRecipeDraft {
  title?: unknown
  description?: unknown
  instructions?: unknown
  preparationTime?: unknown
  tags?: unknown
  ingredients?: unknown
}

/** Models sometimes wrap JSON in a ```json fenced block despite instructions — strip it. */
function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced?.[1] ? fenced[1].trim() : text.trim()
}

function parseIngredient(
  raw: unknown,
  recipeIndex: number,
  ingredientIndex: number,
): RecipeDraftIngredient {
  if (typeof raw !== 'object' || raw === null) {
    throw new RecipeGenerationParseError(
      `recipe ${recipeIndex} ingredient ${ingredientIndex} is not an object`,
    )
  }
  const record = raw as Record<string, unknown>
  if (typeof record.label !== 'string' || record.label.trim().length === 0) {
    throw new RecipeGenerationParseError(
      `recipe ${recipeIndex} ingredient ${ingredientIndex} is missing "label"`,
    )
  }
  return {
    label: record.label,
    // The AI never guesses a productId — no fuzzy name-matching heuristic
    // exists in v1 (Global Constraints; ADR-0010's "not built until a real
    // use-case needs it" stance). The field stays nullable and forward-compatible.
    productId: null,
    // `recipe_ingredient.quantity` is an INTEGER column (docs/phase-0/03) —
    // round rather than reject a whole recipe over a fractional AI value.
    quantity: typeof record.quantity === 'number' ? Math.round(record.quantity) : null,
    unit: typeof record.unit === 'string' ? record.unit : null,
  }
}

function parseDraft(raw: unknown, index: number): RecipeDraft {
  if (typeof raw !== 'object' || raw === null) {
    throw new RecipeGenerationParseError(`recipe ${index} is not an object`)
  }
  const record = raw as RawRecipeDraft
  if (
    typeof record.title !== 'string' ||
    typeof record.instructions !== 'string' ||
    !Array.isArray(record.ingredients)
  ) {
    throw new RecipeGenerationParseError(`recipe ${index} is missing required fields`)
  }
  // Shape alone is not enough: a model that declines ("je ne peux pas…"), runs
  // out of tokens mid-answer or returns a skeleton still hands back a
  // well-formed object with empty strings and no ingredients. Persisting that
  // put a blank recipe in the household's library and called the generation a
  // success — a failed generation must fail, not create something.
  if (
    record.title.trim().length === 0 ||
    record.instructions.trim().length === 0 ||
    record.ingredients.length === 0
  ) {
    throw new RecipeGenerationParseError(`recipe ${index} is empty`)
  }
  return {
    title: record.title.trim(),
    description: typeof record.description === 'string' ? record.description : null,
    instructions: record.instructions.trim(),
    // `recipe.preparation_time` is an INTEGER column (docs/phase-0/03) —
    // round rather than reject a whole recipe over a fractional AI value.
    preparationTime:
      typeof record.preparationTime === 'number' ? Math.round(record.preparationTime) : null,
    tags: Array.isArray(record.tags)
      ? record.tags.filter((t): t is string => typeof t === 'string')
      : [],
    ingredients: record.ingredients.map((i, ingredientIndex) =>
      parseIngredient(i, index, ingredientIndex),
    ),
  }
}

/**
 * Turns a text model's raw response into validated `RecipeDraft[]` — shared
 * by all three `RecipeGenerationPort` adapters (Task 5).
 */
export function parseRecipeDraftsJson(text: string): RecipeDraft[] {
  const jsonText = extractJsonBlock(text)
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new RecipeGenerationParseError('AI response was not valid JSON')
  }

  if (!Array.isArray(raw)) {
    throw new RecipeGenerationParseError('AI response is not a JSON array of recipes')
  }
  if (raw.length === 0) {
    throw new RecipeGenerationParseError('AI response contained no recipes')
  }

  return raw.map(parseDraft)
}
