import vine from '@vinejs/vine'

export const reminderSettingsValidator = vine.compile(
  vine.object({ days: vine.enum([0, 1, 2, 3, 7] as const) }),
)
