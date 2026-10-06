import vine from '@vinejs/vine'

export const enqueueScanValidator = vine.compile(
  vine.object({ language: vine.enum(['fr', 'en'] as const).optional() }),
)
