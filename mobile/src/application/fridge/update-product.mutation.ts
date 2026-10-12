import { defineMutation } from '../shared/define-mutation.js'
import type { UpdateProductInput } from '../../domain/fridge/product.js'

export const useUpdateProductMutation = defineMutation(
  (connector, variables: { productId: string; patch: UpdateProductInput }) =>
    connector.updateProduct(variables.productId, variables.patch),
  { networkMode: 'always' },
)
