/** Structurally identical to the backend's `RecipeDto`/`RecipeIngredientDto` (`recipe.dto.ts`) — no re-mapping on this side. */
export interface RecipeIngredient {
  id: string
  productId: string | null
  label: string
  quantity: number | null
  unit: string | null
}

export interface Recipe {
  /** Shared household state; absent only on older servers. */
  isArchived?: boolean
  isFavorite?: boolean
  id: string
  /**
   * Who put it in the library, and what the foyer has done with it since.
   *
   * `createdBy` / `lastCookedBy` are user ids resolved against the household's
   * own member list — a member who has left resolves to nothing rather than to
   * a name the foyer no longer knows. `null` on rows that predate attribution.
   */
  createdBy: string | null
  cookCount: number
  lastCookedAt: string | null
  lastCookedBy: string | null
  title: string
  description: string | null
  source: string
  instructions: string
  preparationTime: number | null
  tags: string[]
  imageKey: string | null
  ingredients: RecipeIngredient[]
  createdAt: string
}
