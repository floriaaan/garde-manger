import vine from '@vinejs/vine'

const quantitySchema = vine.object({
  amount: vine.number().positive(),
  unit: vine.string().trim().minLength(1),
})
const sourceSchema = vine.enum(['manual', 'auto_expired', 'recipe'] as const)

export const createShoppingItemValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    quantity: quantitySchema,
    source: sourceSchema,
  }),
)

export const updateShoppingItemValidator = vine.compile(
  vine.object({
    expectedUpdatedAt: vine.date({ formats: { utc: true } }).optional(),
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    quantity: quantitySchema.optional(),
    checked: vine.boolean().optional(),
  }),
)
