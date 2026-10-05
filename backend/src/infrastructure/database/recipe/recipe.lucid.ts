import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import RecipeIngredientModel from './recipe_ingredient.lucid.js'
import type { RecipeSourceValue } from '#domain/recipe/recipe-source.vo'

export default class RecipeModel extends BaseModel {
  static table = 'recipe'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'created_by' })
  declare createdBy: string | null

  @column({ columnName: 'is_archived' })
  declare isArchived: boolean

  @column({ columnName: 'is_favorite' })
  declare isFavorite: boolean

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare source: RecipeSourceValue

  @column()
  declare instructions: string

  @column({ columnName: 'preparation_time' })
  declare preparationTime: number | null

  @column()
  declare tags: string[]

  @column({ columnName: 'image_key' })
  declare imageKey: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @hasMany(() => RecipeIngredientModel, { foreignKey: 'recipeId' })
  declare ingredients: HasMany<typeof RecipeIngredientModel>
}
