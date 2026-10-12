import { defineMutation } from '../shared/define-mutation.js'
import type { UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'

export const useUpdateShoppingItemMutation = defineMutation(
  (connector, variables: { itemId: string; patch: UpdateShoppingItemInput }) =>
    connector.updateShoppingItem(variables.itemId, variables.patch),
  { networkMode: 'always' },
)
