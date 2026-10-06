import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from './connector-context.js'
import { useHouseholdDomainQuery } from './use-household-domain-query.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import type { Household } from '../../domain/identity/household.js'
import { useProductsQuery } from '../fridge/products.query.js'
import { useProductQuery } from '../fridge/product.query.js'
import { useProductLookupQuery } from '../fridge/product-lookup.query.js'
import { useShoppingItemsQuery } from '../shopping-list/shopping-items.query.js'
import { useReceiptsQuery } from '../receipt/receipts.query.js'
import { useRecipesQuery } from '../recipe/recipes.query.js'
import { useJobQuery, useJobsQuery } from '../job/jobs.query.js'
import { useScanDraftQuery, useScanDraftsQuery } from '../job/scan-drafts.query.js'
import { useProductOutcomeStatsQuery } from '../fridge/product-outcome-stats.query.js'
import { useReceiptQuery } from '../receipt/receipt.query.js'
import { useRecipeQuery } from '../recipe/recipe.query.js'
import { useHaLinkQuery } from '../home-assistant/ha-link.query.js'
import { useReminderSettingsQuery } from '../settings/reminder-settings.query.js'

function setup(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const reads = [
    jest.spyOn(connector, 'getProducts'),
    jest.spyOn(connector, 'getShoppingItems'),
    jest.spyOn(connector, 'getReceipts'),
    jest.spyOn(connector, 'getRecipes'),
    jest.spyOn(connector, 'getJobs'),
    jest.spyOn(connector, 'getScanDrafts'),
    jest.spyOn(connector, 'getProductOutcomeStats'),
    jest.spyOn(connector, 'getProduct'),
    jest.spyOn(connector, 'getReceipt'),
    jest.spyOn(connector, 'getRecipe'),
    jest.spyOn(connector, 'getScanDraft'),
    jest.spyOn(connector, 'getHaLink'),
    jest.spyOn(connector, 'getReminderSettings'),
  ]
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    )
  }
  return { connector, queryClient, reads, wrapper }
}

function useObservedQueries() {
  return [
    useProductsQuery(), useShoppingItemsQuery(), useReceiptsQuery(),
    useRecipesQuery(), useJobsQuery(), useScanDraftsQuery(),
    useProductOutcomeStatsQuery(), useProductQuery('missing'), useReceiptQuery('missing'),
    useRecipeQuery('missing'), useScanDraftQuery('missing'), useJobQuery('missing'),
    useHaLinkQuery(), useReminderSettingsQuery(),
  ]
}

test('all household reads wait while the household is pending and stay idle when it is absent', async () => {
  const { connector, queryClient, reads, wrapper } = setup()
  let resolveHousehold!: (household: Household | null) => void
  jest.spyOn(connector, 'getHousehold').mockReturnValue(new Promise((resolve) => { resolveHousehold = resolve }))
  const { result } = await renderHook(useObservedQueries, { wrapper })

  await waitFor(() => expect(queryClient.getQueryState(['household'])?.fetchStatus).toBe('fetching'))
  expect(result.current.every((query) => query.fetchStatus === 'idle')).toBe(true)
  reads.forEach((read) => expect(read).not.toHaveBeenCalled())

  await act(async () => { resolveHousehold(null) })
  await waitFor(() => expect(queryClient.getQueryData(['household'])).toBeNull())
  await act(async () => { await queryClient.invalidateQueries() })
  reads.forEach((read) => expect(read).not.toHaveBeenCalled())
})

test('a failed household read does not start the dependent requests', async () => {
  const { connector, queryClient, reads, wrapper } = setup()
  jest.spyOn(connector, 'getHousehold').mockRejectedValue(new Error('offline'))
  await renderHook(useObservedQueries, { wrapper })

  await waitFor(() => expect(queryClient.getQueryState(['household'])?.status).toBe('error'))
  reads.forEach((read) => expect(read).not.toHaveBeenCalled())
})

test.each(['create', 'join'] as const)('publishing the household after %s starts all household reads', async (action) => {
  const { connector, queryClient, reads, wrapper } = setup()
  await connector.signUpEmail('new@example.com', 'password', 'Florian')
  const { result } = await renderHook(useObservedQueries, { wrapper })
  await waitFor(() => expect(queryClient.getQueryData(['household'])).toBeNull())
  reads.forEach((read) => expect(read).not.toHaveBeenCalled())

  const entered = action === 'create'
    ? await connector.createHousehold('Chez nous')
    : await connector.joinHousehold(fakeHousehold.inviteCode!)
  expect(entered.ok).toBe(true)
  if (!entered.ok) throw new Error('household entry failed')
  await act(async () => { queryClient.setQueryData(['household'], entered.value) })

  await waitFor(() => expect(result.current.every((query) => query.isSuccess)).toBe(true))
  reads.forEach((read) => expect(read).toHaveBeenCalled())
})

test.each([
  ['shopping items', useShoppingItemsQuery],
  ['reminder settings', useReminderSettingsQuery],
] as const)('manual refetch cannot bypass a missing household for %s, even with enabled: true', async (_name, useRead) => {
  const { connector, queryClient, reads, wrapper } = setup()
  jest.spyOn(connector, 'getHousehold').mockResolvedValue(null)
  const { result } = await renderHook(() => useRead({ enabled: true }), { wrapper })
  await waitFor(() => expect(queryClient.getQueryData(['household'])).toBeNull())
  // TanStack reports a missing query function for an explicit refetch of skipToken.
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await act(async () => { await result.current.refetch() })
    reads.forEach((read) => expect(read).not.toHaveBeenCalled())
  } finally {
    consoleError.mockRestore()
  }
})

test('detail guards and the scanner manual lookup still apply with a household', async () => {
  const { queryClient, connector, wrapper } = setup()
  queryClient.setQueryData(['household'], fakeHousehold)
  const productRead = jest.spyOn(connector, 'getProduct')
  const draftRead = jest.spyOn(connector, 'getScanDraft')
  const lookupRead = jest.spyOn(connector, 'lookupProductByBarcode')
  const { result } = await renderHook(() => ({
    product: useProductQuery(''), draft: useScanDraftQuery(undefined),
    lookup: useProductLookupQuery('1234567890123'), job: useJobQuery('missing'),
  }), { wrapper })

  await waitFor(() => expect(result.current.job.isSuccess).toBe(true))
  expect(result.current.job.data).toBeNull()
  expect(productRead).not.toHaveBeenCalled()
  expect(draftRead).not.toHaveBeenCalled()
  expect(lookupRead).not.toHaveBeenCalled()
  await act(async () => { await result.current.lookup.refetch() })
  expect(lookupRead).toHaveBeenCalledWith('1234567890123')
})

test('an enabled callback is preserved and cached household data remains usable offline', async () => {
  const { connector, queryClient, reads, wrapper } = setup()
  queryClient.setQueryData(['household'], fakeHousehold)
  jest.spyOn(connector, 'getHousehold').mockRejectedValue(new Error('offline'))
  const enabled = jest.fn(() => false)
  await renderHook(() => ({
    products: useProductsQuery(),
    shopping: useHouseholdDomainQuery(['shopping-items'], (c) => c.getShoppingItems(), { enabled }),
  }), { wrapper })

  await waitFor(() => expect(queryClient.getQueryState(['household'])?.status).toBe('error'))
  await waitFor(() => expect(reads[0]).toHaveBeenCalled())
  expect(enabled).toHaveBeenCalled()
  expect(reads[1]).not.toHaveBeenCalled()
})
