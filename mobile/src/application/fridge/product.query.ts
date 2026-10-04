import { useHouseholdDomainQuery } from '../shared/use-household-domain-query.js'

export function useProductQuery(productId: string) {
  return useHouseholdDomainQuery(['product', productId], (connector) => connector.getProduct(productId), {
    enabled: productId.length > 0,
  })
}
