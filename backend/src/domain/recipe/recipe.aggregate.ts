import { AggregateRoot } from '#domain/shared/aggregate-root'
import { RecipeIngredient } from './recipe-ingredient.entity.js'
import type { RecipeSource } from './recipe-source.vo.js'

/**
 * The last time the foyer actually cooked this, and who did.
 *
 * `userId` is nullable because a member can leave: the cook happened, and the
 * screen says so without naming someone who is no longer here.
 */
export interface RecipeCook {
  userId: string | null
  at: Date
}

interface RecipeProps {
  isArchived?: boolean
  isFavorite?: boolean
  householdId: string
  createdBy: string | null
  title: string
  description: string | null
  source: RecipeSource
  instructions: string
  preparationTime: number | null
  tags: string[]
  imageKey: string | null
  ingredients: RecipeIngredient[]
  createdAt: Date
  /**
   * Derived, not a collection: the log lives in `recipe_cook` and grows
   * without bound, so the aggregate carries the two facts a screen asks for
   * rather than every row that produced them.
   */
  cookCount: number
  lastCook: RecipeCook | null
}

export interface CreateRecipeIngredientProps {
  id: string
  productId?: string | null
  label: string
  quantity?: number | null
  unit?: string | null
}

export interface CreateRecipeProps {
  id: string
  householdId: string
  /** The member who put it in the library — `null` only for rows that predate attribution. */
  createdBy?: string | null
  title: string
  source: RecipeSource
  instructions: string
  ingredients: CreateRecipeIngredientProps[]
  description?: string | null
  preparationTime?: number | null
  tags?: string[]
  imageKey?: string | null
  createdAt: Date
}

export class Recipe extends AggregateRoot<string> {
  private props: RecipeProps

  private constructor(id: string, props: RecipeProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateRecipeProps): Recipe {
    const ingredients = params.ingredients.map((i) =>
      RecipeIngredient.create(i.id, {
        recipeId: params.id,
        productId: i.productId ?? null,
        label: i.label,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
      }),
    )

    return new Recipe(params.id, {
      householdId: params.householdId,
      createdBy: params.createdBy ?? null,
      title: params.title,
      description: params.description ?? null,
      source: params.source,
      instructions: params.instructions,
      preparationTime: params.preparationTime ?? null,
      tags: params.tags ?? [],
      imageKey: params.imageKey ?? null,
      ingredients,
      createdAt: params.createdAt,
      cookCount: 0,
      lastCook: null,
    })
  }

  /** Rehydrates an aggregate from persisted state — used by the mapper (Task 6). */
  static reconstruct(id: string, props: RecipeProps): Recipe {
    return new Recipe(id, props)
  }

  get isArchived(): boolean {
    return this.props.isArchived ?? false
  }

  get isFavorite(): boolean {
    return this.props.isFavorite ?? false
  }

  get householdId(): string {
    return this.props.householdId
  }

  get createdBy(): string | null {
    return this.props.createdBy
  }

  get cookCount(): number {
    return this.props.cookCount
  }

  get lastCook(): RecipeCook | null {
    return this.props.lastCook
  }

  get title(): string {
    return this.props.title
  }

  get description(): string | null {
    return this.props.description
  }

  get source(): RecipeSource {
    return this.props.source
  }

  get instructions(): string {
    return this.props.instructions
  }

  get preparationTime(): number | null {
    return this.props.preparationTime
  }

  get tags(): string[] {
    return this.props.tags
  }

  get imageKey(): string | null {
    return this.props.imageKey
  }

  get ingredients(): RecipeIngredient[] {
    return this.props.ingredients
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
