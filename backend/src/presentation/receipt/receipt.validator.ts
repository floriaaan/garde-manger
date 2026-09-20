import vine from '@vinejs/vine'

// `formats: { utc: true }` accepts ISO-8601 UTC strings (e.g. `Date#toISOString()`
// output) — vine.date()'s default formats otherwise reject them outright. Same fix
// as `backend/src/presentation/fridge/product.validator.ts` (Task 7).
const dateSchema = vine.date({ formats: { utc: true } })

export const importReceiptValidator = vine.compile(
  vine.object({
    draftId: vine.string().trim().minLength(1).optional(),
    storeName: vine.string().trim().minLength(1).maxLength(120),
    scannedAt: dateSchema,
    totalAmount: vine.number().positive(),
    items: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(1),
          quantity: vine.number().positive(),
          unit: vine.string().trim().minLength(1),
          category: vine.string().trim().optional(),
          price: vine.number().positive().optional(),
          location: vine.enum(['fridge', 'freezer', 'pantry'] as const),
          expiresAt: dateSchema.optional(),
        }),
      )
      .minLength(1),
  }),
)
