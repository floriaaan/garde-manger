import vine from '@vinejs/vine'

export const updateRecipeStateValidator = vine.compile(
  vine.object({ isArchived: vine.boolean().optional(), isFavorite: vine.boolean().optional() }),
)

const recipeSourceSchema = vine.enum(['ai', 'user'] as const)
const ingredientSchema = vine.object({
  label: vine.string().trim().minLength(1),
  productId: vine.string().trim().optional().nullable(),
  quantity: vine.number().optional().nullable(),
  unit: vine.string().trim().optional().nullable(),
})

export const generateRecipesValidator = vine.compile(
  vine.object({
    prompt: vine.string().trim().maxLength(500).optional(),
  }),
)

export const saveRecipeValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(120),
    source: recipeSourceSchema,
    instructions: vine.string().trim().minLength(1),
    description: vine.string().trim().optional().nullable(),
    preparationTime: vine.number().positive().optional().nullable(),
    tags: vine.array(vine.string().trim()).optional(),
    ingredients: vine.array(ingredientSchema).minLength(1),
  }),
)

/**
 * The products this meal used up. Optional and allowed to be empty: "j'ai
 * cuisiné" is worth recording even when nothing left the garde-manger, and an
 * id that no longer exists is skipped rather than failing the meal.
 */
export const cookRecipeValidator = vine.compile(
  vine.object({
    productIds: vine.array(vine.string().trim().minLength(1)).optional(),
  }),
)
