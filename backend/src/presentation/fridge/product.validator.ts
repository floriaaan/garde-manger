import vine from '@vinejs/vine'

const quantitySchema = vine.object({
  amount: vine.number().positive(),
  unit: vine.string().trim().minLength(1),
})
const locationSchema = vine.enum(['fridge', 'freezer', 'pantry'] as const)
// `formats: { utc: true }` accepts ISO-8601 UTC strings (e.g. `Date#toISOString()`
// output) — vine.date()'s default formats otherwise reject them outright.
const dateSchema = vine.date({ formats: { utc: true } })

export const createProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    quantity: quantitySchema,
    location: locationSchema,
    category: vine.string().trim().minLength(1).maxLength(80),
    expiresAt: dateSchema.optional(),
    openedAt: dateSchema.optional(),
    openfoodfactId: vine.string().trim().optional(),
    categories: vine.array(vine.string().trim()).optional(),
    price: vine.number().positive().optional(),
  }),
)

export const updateProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    quantity: quantitySchema.optional(),
    location: locationSchema.optional(),
    category: vine.string().trim().minLength(1).maxLength(80).optional(),
    expiresAt: dateSchema.optional().nullable(),
    openedAt: dateSchema.optional().nullable(),
    openfoodfactId: vine.string().trim().optional().nullable(),
    categories: vine.array(vine.string().trim()).optional().nullable(),
    price: vine.number().positive().optional().nullable(),
  }),
)

export const listProductsValidator = vine.compile(
  vine.object({
    location: locationSchema.optional(),
    expiringWithinDays: vine.number().positive().optional(),
  }),
)

export const expiringSoonValidator = vine.compile(
  vine.object({ days: vine.number().positive().optional() }),
)

export const lookupProductValidator = vine.compile(
  vine.object({ barcode: vine.string().trim().minLength(1) }),
)

export const productOutcomeStatsValidator = vine.compile(
  vine.object({ days: vine.number().withoutDecimals().positive().optional() }),
)

export const importProductsValidator = vine.compile(
  vine.object({
    draftId: vine.string().trim().minLength(1).optional(),
    items: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(1),
          quantity: vine.number().positive(),
          unit: vine.string().trim().minLength(1),
          category: vine.string().trim().optional(),
          location: locationSchema,
          expiresAt: dateSchema.optional(),
        }),
      )
      .minLength(1),
  }),
)

export const recordProductOutcomeValidator = vine.compile(
  vine.object({
    kind: vine.enum(['consumed', 'discarded'] as const),
    amount: vine.number().withoutDecimals().positive().optional(),
    discardReason: vine
      .enum(['expired', 'spoiled', 'disliked', 'other'] as const)
      .optional()
      .nullable(),
  }),
)
