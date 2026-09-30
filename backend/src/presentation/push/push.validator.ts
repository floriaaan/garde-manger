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

export const registerWebPushValidator = vine.compile(
  vine.object({
    endpoint: vine.string().trim().minLength(1).maxLength(2048),
    keys: vine.object({
      p256dh: vine
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .maxLength(128),
      auth: vine
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .maxLength(64),
    }),
  }),
)

export const unregisterWebPushValidator = vine.compile(
  vine.object({
    endpoint: vine.string().trim().minLength(1).maxLength(2048),
  }),
)
