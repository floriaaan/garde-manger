import { defineHouseholdQuery } from '../shared/use-household-domain-query.js'

export const useReceiptsQuery = defineHouseholdQuery(['receipts'], (connector) => connector.getReceipts())
