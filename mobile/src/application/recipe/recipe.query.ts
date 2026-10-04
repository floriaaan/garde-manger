import { useHouseholdDomainQuery } from '../shared/use-household-domain-query.js'

export function useRecipeQuery(recipeId: string) {
  return useHouseholdDomainQuery(['recipe', recipeId], (connector) => connector.getRecipe(recipeId), {
    enabled: recipeId.length > 0,
  })
}
