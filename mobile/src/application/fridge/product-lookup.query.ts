import { useHouseholdDomainQuery } from '../shared/use-household-domain-query.js'

/** Not fetched on mount — the scanner/form calls `.refetch()` once a barcode is captured. */
export function useProductLookupQuery(barcode: string) {
  return useHouseholdDomainQuery(['product-lookup', barcode], (connector) => connector.lookupProductByBarcode(barcode), {
    enabled: false,
  })
}
