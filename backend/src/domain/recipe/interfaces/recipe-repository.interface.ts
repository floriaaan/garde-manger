import type { Recipe } from '../recipe.aggregate.js'

/** One "j'ai cuisiné", as it is written down. */
export interface RecordCookParams {
  id: string
  recipeId: string
  householdId: string
  /** `null` is never written here — the column only becomes null when the member leaves. */
  userId: string
  productsUsed: number
  at: Date
}

export interface RecipeRepository {
  findById(id: string): Promise<Recipe | null>
  findByHousehold(householdId: string): Promise<Recipe[]>
  save(recipe: Recipe): Promise<void>
  delete(id: string): Promise<void>
  updateState(
    id: string,
    householdId: string,
    state: { isArchived?: boolean; isFavorite?: boolean },
  ): Promise<Recipe | null>
  /**
   * Appends to the cook log. Separate from `save` because it is an event about
   * the recipe, not a new version of it: two members cooking the same dish on
   * the same evening are two facts, and a `save` would have one overwrite the
   * other.
   */
  recordCook(params: RecordCookParams): Promise<void>
}
