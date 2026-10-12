import { defineMutation } from '../shared/define-mutation.js'

export const useDeleteProductMutation = defineMutation(
  (connector, productId: string) => connector.deleteProduct(productId),
  { networkMode: 'always' },
)
