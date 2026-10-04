import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeIngredient } from '#domain/recipe/recipe-ingredient.entity'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'
import type RecipeModel from './recipe.lucid.js'
import type { RecipeCook } from '#domain/recipe/recipe.aggregate'

/**
 * The cook facts a screen asks for, read alongside the row rather than
 * preloaded as a collection: the log grows for the life of the household and
 * only its size and its most recent entry are ever displayed.
 */
export interface RecipeCookStats {
  cookCount: number
  lastCook: RecipeCook | null
}

const NEVER_COOKED: RecipeCookStats = { cookCount: 0, lastCook: null }

export function toDomain(row: RecipeModel, stats: RecipeCookStats = NEVER_COOKED): Recipe {
  const source = RecipeSource.create(row.source)
  if (!source.ok) throw new Error(`Corrupted recipe row ${row.id}: ${source.error.message}`)

  const ingredients = row.ingredients.map((i) =>
    RecipeIngredient.create(i.id, {
      recipeId: i.recipeId,
      productId: i.productId,
      label: i.label,
      quantity: i.quantity,
      unit: i.unit,
    }),
  )

  return Recipe.reconstruct(row.id, {
    householdId: row.householdId,
    isArchived: row.isArchived,
    isFavorite: row.isFavorite,
    createdBy: row.createdBy,
    title: row.title,
    description: row.description,
    source: source.value,
    instructions: row.instructions,
    preparationTime: row.preparationTime,
    tags: row.tags,
    imageKey: row.imageKey,
    ingredients,
    createdAt: row.createdAt.toJSDate(),
    cookCount: stats.cookCount,
    lastCook: stats.lastCook,
  })
}
