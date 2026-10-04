import { defineHouseholdQuery } from '../shared/use-household-domain-query.js'

export const useRecipesQuery = defineHouseholdQuery(['recipes'], (connector) => connector.getRecipes())
