import { useHouseholdDomainQuery } from '../shared/use-household-domain-query.js'
import type { LocationValue } from '../../domain/fridge/location.js'

export function useProductsQuery(params?: { location?: LocationValue; expiringWithinDays?: number }) {
  return useHouseholdDomainQuery(['products', params ?? {}], (connector) => connector.getProducts(params))
}
