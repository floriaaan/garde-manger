import vine from '@vinejs/vine'

export const createHouseholdValidator = vine.compile(
  vine.object({ name: vine.string().trim().minLength(1).maxLength(80) }),
)

export const joinHouseholdValidator = vine.compile(
  vine.object({ inviteCode: vine.string().trim().minLength(8).maxLength(8) }),
)

export const transferHouseholdOwnershipValidator = vine.compile(
  vine.object({ newOwnerId: vine.string().trim().minLength(1) }),
)

export const renameHouseholdValidator = createHouseholdValidator
