import vine from '@vinejs/vine'

export const registerPushTokenValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1).maxLength(255),
    platform: vine.enum(['ios', 'android']),
  }),
)

export const unregisterPushTokenValidator = vine.compile(
  vine.object({ token: vine.string().trim().minLength(1).maxLength(255) }),
)
