import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import RecipeModel from './recipe.lucid.js'
import RecipeIngredientModel from './recipe_ingredient.lucid.js'
import RecipeCookModel from './recipe_cook.lucid.js'
import { toDomain } from './recipe.mapper.js'
import type { RecipeCookStats } from './recipe.mapper.js'
import type {
  RecipeRepository,
  RecordCookParams,
} from '#domain/recipe/interfaces/recipe-repository.interface'
import type { Recipe } from '#domain/recipe/recipe.aggregate'

/**
 * Count and most-recent cook for a set of recipes, in one query rather than
 * two per row: the library lists every recipe the foyer has, and a per-recipe
 * lookup would be the N+1 the preload on `ingredients` was written to avoid.
 *
 * `array_agg(... order by ...)` instead of a second `DISTINCT ON` pass —
 * Postgres can answer "how many, and who was last" in a single grouped scan,
 * and this app has no other database.
 */
async function cookStatsFor(recipeIds: string[]): Promise<Map<string, RecipeCookStats>> {
  const stats = new Map<string, RecipeCookStats>()
  if (recipeIds.length === 0) return stats

  const { rows } = await db.rawQuery(
    `select recipe_id,
            count(*)::int as total,
            max(cooked_at) as last_at,
            (array_agg(cooked_by order by cooked_at desc))[1] as last_by
       from recipe_cook
      where recipe_id = any(?)
      group by recipe_id`,
    [recipeIds],
  )

  for (const row of rows as {
    recipe_id: string
    total: number
    last_at: Date | string
    last_by: string | null
  }[]) {
    stats.set(row.recipe_id, {
      cookCount: Number(row.total),
      lastCook: { userId: row.last_by, at: new Date(row.last_at) },
    })
  }
  return stats
}

/**
 * Persists the aggregate + its internal `RecipeIngredient` entities in one
 * transaction, diffing removed ingredient rows — same pattern as
 * `LucidHouseholdRepository.save()` for `Household`/`HouseholdMember`.
 */
export class LucidRecipeRepository implements RecipeRepository {
  async findById(id: string): Promise<Recipe | null> {
    const row = await RecipeModel.query().where('id', id).preload('ingredients').first()
    if (!row) return null
    const stats = await cookStatsFor([row.id])
    return toDomain(row, stats.get(row.id))
  }

  async findByHousehold(householdId: string): Promise<Recipe[]> {
    const rows = await RecipeModel.query()
      .where('household_id', householdId)
      .preload('ingredients')
      .orderBy('created_at', 'desc')
    const stats = await cookStatsFor(rows.map((row) => row.id))
    return rows.map((row) => toDomain(row, stats.get(row.id)))
  }

  async save(recipe: Recipe): Promise<void> {
    await db.transaction(async (trx) => {
      await RecipeModel.updateOrCreate(
        { id: recipe.id },
        {
          householdId: recipe.householdId,
          createdBy: recipe.createdBy,
          title: recipe.title,
          description: recipe.description,
          source: recipe.source.value,
          instructions: recipe.instructions,
          preparationTime: recipe.preparationTime,
          tags: recipe.tags,
          imageKey: recipe.imageKey,
        },
        { client: trx },
      )

      const existingRows = await RecipeIngredientModel.query({ client: trx }).where(
        'recipe_id',
        recipe.id,
      )
      const currentIds = new Set(recipe.ingredients.map((i) => i.id))

      const removedIds = existingRows.filter((row) => !currentIds.has(row.id)).map((row) => row.id)
      if (removedIds.length > 0) {
        await RecipeIngredientModel.query({ client: trx }).whereIn('id', removedIds).delete()
      }

      for (const ingredient of recipe.ingredients) {
        await RecipeIngredientModel.updateOrCreate(
          { id: ingredient.id },
          {
            recipeId: ingredient.recipeId,
            productId: ingredient.productId,
            label: ingredient.label,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          },
          { client: trx },
        )
      }
    })
  }

  async updateState(
    id: string,
    householdId: string,
    state: { isArchived?: boolean; isFavorite?: boolean },
  ): Promise<Recipe | null> {
    // Update only supplied columns: simultaneous archive and favorite edits cannot overwrite each other.
    const changes: Record<string, boolean> = {}
    if (state.isArchived !== undefined) changes.is_archived = state.isArchived
    if (state.isFavorite !== undefined) changes.is_favorite = state.isFavorite
    const rows = await RecipeModel.query()
      .where('id', id)
      .where('household_id', householdId)
      .update(changes)
      .returning('id')
    return rows.length > 0 ? this.findById(id) : null
  }

  async delete(id: string): Promise<void> {
    await RecipeModel.query().where('id', id).delete()
  }

  async recordCook(params: RecordCookParams): Promise<void> {
    await RecipeCookModel.create({
      id: params.id,
      recipeId: params.recipeId,
      householdId: params.householdId,
      cookedBy: params.userId,
      productsUsed: params.productsUsed,
      cookedAt: DateTime.fromJSDate(params.at),
    })
  }
}
