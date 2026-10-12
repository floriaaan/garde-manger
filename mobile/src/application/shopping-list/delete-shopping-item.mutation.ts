import { defineMutation } from '../shared/define-mutation.js'

export const useDeleteShoppingItemMutation = defineMutation(
  (connector, itemId: string) => connector.deleteShoppingItem(itemId),
  { networkMode: 'always' },
)
