import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import { useDomainMutation } from './use-domain-mutation.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

export function defineMutation<TVariables, TData>(
  mutationFn: (connector: FridgeConnector, variables: TVariables) => Promise<TData>,
  defaults?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
) {
  return function useThisMutation(
    options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
  ): UseMutationResult<TData, Error, TVariables> {
    return useDomainMutation(mutationFn, { ...defaults, ...options })
  }
}
