import type { ListRecipes } from '#application/recipe/list-recipes.use-case'
import type { ShowRecipe } from '#application/recipe/show-recipe.use-case'
import type { SuggestRecipes } from '#application/recipe/suggest-recipes.use-case'
import type { SaveRecipe } from '#application/recipe/save-recipe.use-case'
import type { CookRecipe } from '#application/recipe/cook-recipe.use-case'
import type { UpdateRecipeState } from '#application/recipe/update-recipe-state.use-case'
import type { DeleteRecipe } from '#application/recipe/delete-recipe.use-case'
import type { ApplicationService } from '@adonisjs/core/types'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'

export default class RecipeProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind('recipe.listRecipes', async (resolver) => {
      const { ListRecipes } = await import('#application/recipe/list-recipes.use-case')
      return new ListRecipes(await resolver.make('recipe.recipes'))
    })

    this.app.container.bind('recipe.showRecipe', async (resolver) => {
      const { ShowRecipe } = await import('#application/recipe/show-recipe.use-case')
      return new ShowRecipe(await resolver.make('recipe.recipes'))
    })

    this.app.container.bind('recipe.createSuggestRecipes', async (resolver) => {
      const { SuggestRecipes } = await import('#application/recipe/suggest-recipes.use-case')
      const products = await resolver.make('fridge.products')
      const resolveGeneration = await resolver.make('settings.resolveRecipeGenerationPort')
      return async (householdId: string) =>
        new SuggestRecipes(products, await resolveGeneration(householdId))
    })

    this.app.container.bind('recipe.saveRecipe', async (resolver) => {
      const { SaveRecipe } = await import('#application/recipe/save-recipe.use-case')
      return new SaveRecipe(
        await resolver.make('recipe.recipes'),
        await resolver.make('fridge.products'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('recipe.cookRecipe', async (resolver) => {
      const { CookRecipe } = await import('#application/recipe/cook-recipe.use-case')
      return new CookRecipe(
        await resolver.make('recipe.recipes'),
        await resolver.make('fridge.products'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('recipe.updateRecipeState', async (resolver) => {
      const { UpdateRecipeState } = await import('#application/recipe/update-recipe-state.use-case')
      return new UpdateRecipeState(await resolver.make('recipe.recipes'))
    })

    this.app.container.bind('recipe.deleteRecipe', async (resolver) => {
      const { DeleteRecipe } = await import('#application/recipe/delete-recipe.use-case')
      return new DeleteRecipe(await resolver.make('recipe.recipes'))
    })

    this.app.container.singleton('recipe.recipes', async () => {
      const { LucidRecipeRepository } =
        await import('#infrastructure/database/recipe/recipe.repository')
      return new LucidRecipeRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'recipe.listRecipes': ListRecipes
    'recipe.showRecipe': ShowRecipe
    'recipe.createSuggestRecipes': (householdId: string) => Promise<SuggestRecipes>
    'recipe.saveRecipe': SaveRecipe
    'recipe.cookRecipe': CookRecipe
    'recipe.updateRecipeState': UpdateRecipeState
    'recipe.deleteRecipe': DeleteRecipe
    'recipe.recipes': RecipeRepository
  }
}
