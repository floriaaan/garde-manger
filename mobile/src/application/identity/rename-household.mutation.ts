import { defineMutation } from '../shared/define-mutation.js'

export const useRenameHouseholdMutation = defineMutation((connector, name: string) =>
  connector.renameHousehold(name),
)
