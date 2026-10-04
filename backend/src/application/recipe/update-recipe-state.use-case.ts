import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { Recipe } from '#domain/recipe/recipe.aggregate'
import { Result } from '#domain/shared/result'

interface Input {
  householdId: string
  recipeId: string
  isArchived?: boolean
  isFavorite?: boolean
}

export class UpdateRecipeState implements UseCase<Input, Result<Recipe, 'recipe_not_found'>> {
  constructor(private readonly recipes: RecipeRepository) {}

  async execute({ recipeId, householdId, ...state }: Input): Promise<Result<Recipe, 'recipe_not_found'>> {
    const recipe = await this.recipes.updateState(recipeId, householdId, state)
    return recipe ? Result.ok(recipe) : Result.err('recipe_not_found')
  }
}
