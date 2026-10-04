import { useHouseholdDomainQuery } from '../shared/use-household-domain-query.js'

export function useReceiptQuery(receiptId: string) {
  return useHouseholdDomainQuery(['receipt', receiptId], (connector) => connector.getReceipt(receiptId), {
    enabled: receiptId.length > 0,
  })
}
