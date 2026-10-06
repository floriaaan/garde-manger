import type { AiLanguage } from '#domain/shared/ai-language'
import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'
import {
  RecipeGenerationUnavailableError,
  RecipeGenerationParseError,
} from '#domain/recipe/recipe-generation.errors'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface GenerateRecipesInput {
  householdId: string
  /** The member doing it — the library is shared, so every row records who added it. */
  createdBy: string
  prompt?: string
  language?: AiLanguage
}

export type GenerateRecipesError = 'provider_not_configured' | 'generation_failed'

/**
 * Persists every generated draft immediately (unlike `SuggestRecipes`,
 * which never persists) — matches `POST /api/recipes/generate`'s contract
 * in docs/phase-0/04-endpoints-http.md.
 */
export class GenerateRecipes implements UseCase<
  GenerateRecipesInput,
  ResultType<Recipe[], GenerateRecipesError>
> {
  constructor(
    private readonly recipes: RecipeRepository,
    private readonly products: ProductRepository,
    private readonly generation: RecipeGenerationPort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: GenerateRecipesInput): Promise<ResultType<Recipe[], GenerateRecipesError>> {
    const householdProducts = await this.products.findByHousehold(input.householdId)

    let drafts
    try {
      drafts = await this.generation.generate({
        products: householdProducts.map((p) => ({
          name: p.name,
          category: p.category,
          expiresAt: p.expiresAt,
        })),
        prompt: input.prompt,
        language: input.language,
        prioritizeExpiringSoon: false,
      })
    } catch (error) {
      if (error instanceof RecipeGenerationUnavailableError)
        return Result.err('provider_not_configured')
      if (error instanceof RecipeGenerationParseError) return Result.err('generation_failed')
      throw error
    }

    const source = RecipeSource.create('ai')
    if (!source.ok) throw new Error('unreachable: "ai" is always a valid RecipeSource')

    const now = this.clock.now()
    const recipes = drafts.map((draft) =>
      Recipe.create({
        id: this.idGenerator.next(),
        householdId: input.householdId,
        createdBy: input.createdBy,
        title: draft.title,
        description: draft.description,
        source: source.value,
        instructions: draft.instructions,
        preparationTime: draft.preparationTime,
        tags: draft.tags,
        ingredients: draft.ingredients.map((i) => ({
          id: this.idGenerator.next(),
          productId: i.productId,
          label: i.label,
          quantity: i.quantity,
          unit: i.unit,
        })),
        createdAt: now,
      }),
    )

    for (const recipe of recipes) {
      await this.recipes.save(recipe)
    }

    return Result.ok(recipes)
  }
}
