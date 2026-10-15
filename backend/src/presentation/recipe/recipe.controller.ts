import { resolveBinding } from '#presentation/shared/resolve-binding'
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  cookRecipeValidator,
  saveRecipeValidator,
  updateRecipeStateValidator,
} from './recipe.validator.js'
import { toRecipeDto, toRecipeDraftDto } from './recipe.dto.js'
import { SuggestRecipes } from '#application/recipe/suggest-recipes.use-case'
import { SaveRecipe } from '#application/recipe/save-recipe.use-case'
import { ListRecipes } from '#application/recipe/list-recipes.use-case'
import { ShowRecipe } from '#application/recipe/show-recipe.use-case'
import { DeleteRecipe } from '#application/recipe/delete-recipe.use-case'
import { UpdateRecipeState } from '#application/recipe/update-recipe-state.use-case'
import { CookRecipe } from '#application/recipe/cook-recipe.use-case'

export default class RecipeController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'recipe',
      ListRecipes,
      async () => {
        const listRecipes = await resolveBinding(ctx, 'recipe.listRecipes')
        const result = await listRecipes.execute({ householdId: ctx.household.id })
        ctx.response.json({ recipes: result.map(toRecipeDto) })
      },
      { action: 'recipe.get_recipes' },
    )
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'recipe',
      ShowRecipe,
      async () => {
        const showRecipe = await resolveBinding(ctx, 'recipe.showRecipe')
        const recipe = await showRecipe.execute({
          householdId: ctx.household.id,
          recipeId: ctx.params.id,
        })
        if (!recipe) {
          const { status, body } = serializeError('recipe_not_found')
          ctx.response.status(status).json(body)
          return { failed: true }
        }
        ctx.response.json({ recipe: toRecipeDto(recipe) })
        return { failed: false }
      },
      { isError: (r) => r.failed, action: 'recipe.get_recipe' },
    )
  }

  async suggestions(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'recipe',
      SuggestRecipes,
      async () => {
        const createSuggestRecipes = await resolveBinding(ctx, 'recipe.createSuggestRecipes')

        const suggestRecipes = await createSuggestRecipes(ctx.household.id)
        const result = await suggestRecipes.execute({
          householdId: ctx.household.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json({ recipes: result.value.map(toRecipeDraftDto) })
        return result
      },
      { isError: (r) => !r.ok },
    )
  }

  async store(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'recipe',
      SaveRecipe,
      async () => {
        const payload = await ctx.request.validateUsing(saveRecipeValidator)

        const saveRecipe = await resolveBinding(ctx, 'recipe.saveRecipe')
        const result = await saveRecipe.execute({
          householdId: ctx.household.id,
          createdBy: user.id,
          ...payload,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(201).json({ recipe: toRecipeDto(result.value) })
        return result
      },
      { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.id : undefined) },
    )
  }

  /**
   * "J'ai cuisiné" — the other half of the recommendation.
   *
   * The client sends the products the meal used up, because the client is
   * where the rapprochement between an ingredient and a real product was
   * confirmed; the generator never links them.
   */
  async cooked(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'recipe',
      CookRecipe,
      async () => {
        const { productIds } = await ctx.request.validateUsing(cookRecipeValidator)

        const cookRecipe = await resolveBinding(ctx, 'recipe.cookRecipe')
        const result = await cookRecipe.execute({
          householdId: ctx.household.id,
          userId: user.id,
          recipeId: ctx.params.id,
          productIds: productIds ?? [],
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json({ recipe: toRecipeDto(result.value) })
        return result
      },
      { isError: (r) => !r.ok },
    )
  }

  async updateState(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'recipe',
      UpdateRecipeState,
      async () => {
        const state = await ctx.request.validateUsing(updateRecipeStateValidator)
        if (state.isArchived === undefined && state.isFavorite === undefined) {
          ctx.response.status(422).json({ message: 'Un état de recette est requis.' })
          return { failed: true }
        }
        const updateRecipeState = await resolveBinding(ctx, 'recipe.updateRecipeState')
        const result = await updateRecipeState.execute({
          householdId: ctx.household.id,
          recipeId: ctx.params.id,
          ...state,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return { failed: true }
        }
        ctx.response.json({ recipe: toRecipeDto(result.value) })
        return { failed: false }
      },
      { isError: (r) => r.failed, action: 'recipe.update_state' },
    )
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'recipe',
      DeleteRecipe,
      async () => {
        const deleteRecipe = await resolveBinding(ctx, 'recipe.deleteRecipe')
        const result = await deleteRecipe.execute({
          householdId: ctx.household.id,
          recipeId: ctx.params.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(204).send('')
        return result
      },
      { isError: (r) => !r.ok },
    )
  }
}
