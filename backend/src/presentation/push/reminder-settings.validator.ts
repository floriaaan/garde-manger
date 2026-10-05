import vine from '@vinejs/vine'

export const reminderSettingsValidator = vine.compile(
  vine.object({
    days: vine.enum([0, 1, 2, 3, 7] as const).optional(),
    enabled: vine.boolean().optional(),
    checkupEnabled: vine.boolean().optional(),
    checkupDay: vine.enum([0, 1, 2, 3, 4, 5, 6] as const).optional(),
  }),
)
