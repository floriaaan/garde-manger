import { defineHouseholdQuery } from '../shared/use-household-domain-query.js'

export const useHaLinkQuery = defineHouseholdQuery(['ha-link'], (connector) => connector.getHaLink())
