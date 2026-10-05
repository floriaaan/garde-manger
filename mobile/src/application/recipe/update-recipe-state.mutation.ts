import { defineMutation } from '../shared/define-mutation.js'

export const useUpdateRecipeStateMutation = defineMutation((connector, input: {
  recipeId: string
  state: { isArchived?: boolean; isFavorite?: boolean }
}) => connector.updateRecipeState(input.recipeId, input.state))
