import type { Recipe } from '#domain/recipe/recipe.aggregate'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'

export interface RecipeIngredientDto {
  id: string
  productId: string | null
  label: string
  quantity: number | null
  unit: string | null
}

export interface RecipeDto {
  isArchived: boolean
  isFavorite: boolean
  id: string
  /**
   * The member who put it in the library, and what the foyer has done with it
   * since. A shared library whose rows carry no author or history is a pile;
   * these three fields are what let a screen say "Camille · cuisinée 2 fois"
   * instead of sorting by a timestamp nobody can see.
   *
   * Ids, not names: the client already holds the household's members and
   * resolves them itself, and a member who has left resolves to nothing rather
   * than to a name the foyer no longer knows.
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
  ingredients: RecipeIngredientDto[]
  createdAt: string
}

export interface RecipeDraftDto {
  title: string
  description: string | null
  instructions: string
  preparationTime: number | null
  tags: string[]
  ingredients: {
    label: string
    productId: string | null
    quantity: number | null
    unit: string | null
  }[]
}

export function toRecipeDto(recipe: Recipe): RecipeDto {
  return {
    id: recipe.id,
    isArchived: recipe.isArchived,
    isFavorite: recipe.isFavorite,
    createdBy: recipe.createdBy,
    cookCount: recipe.cookCount,
    lastCookedAt: recipe.lastCook?.at.toISOString() ?? null,
    lastCookedBy: recipe.lastCook?.userId ?? null,
    title: recipe.title,
    description: recipe.description,
    source: recipe.source.value,
    instructions: recipe.instructions,
    preparationTime: recipe.preparationTime,
    tags: recipe.tags,
    imageKey: recipe.imageKey,
    ingredients: recipe.ingredients.map((i) => ({
      id: i.id,
      productId: i.productId,
      label: i.label,
      quantity: i.quantity,
      unit: i.unit,
    })),
    createdAt: recipe.createdAt.toISOString(),
  }
}

export function toRecipeDraftDto(draft: RecipeDraft): RecipeDraftDto {
  return {
    title: draft.title,
    description: draft.description,
    instructions: draft.instructions,
    preparationTime: draft.preparationTime,
    tags: draft.tags,
    ingredients: draft.ingredients,
  }
}
