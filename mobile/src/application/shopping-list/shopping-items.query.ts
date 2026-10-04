import { defineHouseholdQuery } from '../shared/use-household-domain-query.js'

export const useShoppingItemsQuery = defineHouseholdQuery(['shopping-items'], (connector) => connector.getShoppingItems())
