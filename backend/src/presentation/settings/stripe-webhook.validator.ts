import vine from '@vinejs/vine'

/**
 * Only what `HandleStripeWebhook` reads. `current_period_end` sits on the
 * subscription in older API versions and on its first item since `basil` —
 * both accepted, cf. the controller.
 */
export const stripeWebhookValidator = vine.compile(
  vine.object({
    type: vine.string(),
    data: vine.object({
      object: vine.object({
        id: vine.string(),
        customer: vine.string(),
        status: vine.string(),
        cancel_at_period_end: vine.boolean().optional(),
        cancel_at: vine.number().nullable().optional(),
        current_period_end: vine.number().nullable().optional(),
        items: vine
          .object({
            data: vine.array(
              vine.object({ current_period_end: vine.number().nullable().optional() }),
            ),
          })
          .optional(),
        metadata: vine.record(vine.string()).optional(),
      }),
    }),
  }),
)
