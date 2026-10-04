import { skipToken, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useHouseholdQuery } from '../identity/household.query.js'
import { useConnector } from './connector-context.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

/** Household reads also guard pushed screens, which live outside the tabs' gate. */
export function useHouseholdDomainQuery<TData, TSelected = TData>(
  queryKey: unknown[],
  queryFn: (connector: FridgeConnector) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, Error, TSelected>, 'queryKey' | 'queryFn'>,
): UseQueryResult<TSelected> {
  const connector = useConnector()
  const household = useHouseholdQuery()
  const hasHousehold = Boolean(household.data?.id)

  return useQuery<TData, Error, TSelected>({
    ...options,
    queryKey,
    // `enabled` alone lets a manual refetch bypass the household guard.
    queryFn: hasHousehold ? () => queryFn(connector) : skipToken,
    enabled: (query) => hasHousehold && (
      typeof options?.enabled === 'function' ? options.enabled(query) : options?.enabled !== false
    ),
  })
}

export function defineHouseholdQuery<TData>(
  queryKey: unknown[],
  queryFn: (connector: FridgeConnector) => Promise<TData>,
) {
  return function useThisQuery(
    options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>,
  ): UseQueryResult<TData> {
    return useHouseholdDomainQuery(queryKey, queryFn, options)
  }
}
