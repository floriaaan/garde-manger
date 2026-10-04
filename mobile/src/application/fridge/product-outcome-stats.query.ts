import { useHouseholdDomainQuery } from '../shared/use-household-domain-query.js'

export function useProductOutcomeStatsQuery(days?: number) {
  return useHouseholdDomainQuery(['product-outcome-stats', days ?? 'all'], (connector) => connector.getProductOutcomeStats(days))
}
