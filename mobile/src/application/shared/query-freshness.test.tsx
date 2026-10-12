import { act, renderHook, waitFor } from '@testing-library/react-native'
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from './connector-context.js'
import { queryStaleTime } from './query-freshness.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { useProductsQuery } from '../fridge/products.query.js'
import { useShoppingItemsQuery } from '../shopping-list/shopping-items.query.js'
import { useReceiptsQuery } from '../receipt/receipts.query.js'
import { useDomainQuery } from './use-domain-query.js'
import type { Product } from '../../domain/fridge/product.js'

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  client.setQueryData(['household'], fakeHousehold)
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><ConnectorProvider connector={connector}>{children}</ConnectorProvider></QueryClientProvider>
  }
  return { client, connector, wrapper }
}

afterEach(() => {
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
  jest.restoreAllMocks()
})

test('freshness uses the domain for list/detail/filter keys and preserves session checks', () => {
  expect(queryStaleTime(['products', { location: 'fridge' }])).toBe(30_000)
  expect(queryStaleTime(['product', 'p1'])).toBe(30_000)
  expect(queryStaleTime(['shopping-items'])).toBe(30_000)
  expect(queryStaleTime(['household'])).toBe(60_000)
  expect(queryStaleTime(['jobs'])).toBe(2_000)
  expect(queryStaleTime(['recipes'])).toBe(300_000)
  expect(queryStaleTime(['reminder-settings'])).toBe(300_000)
  expect(queryStaleTime(['session'])).toBe(0)
  expect(queryStaleTime(['unknown'])).toBe(0)
})

test('stale cached products render during refresh and survive failure, including an empty cache', async () => {
  const { client, connector, wrapper } = setup()
  const cached = await connector.getProducts()
  client.setQueryData(['products', {}], cached, { updatedAt: Date.now() - 30_001 })
  let reject!: (error: Error) => void
  jest.spyOn(connector, 'getProducts').mockImplementation(() => new Promise((_resolve, fail) => { reject = fail }))
  const { result, unmount } = await renderHook(useProductsQuery, { wrapper })
  try {
    expect(result.current.data).toEqual(cached)
    expect(result.current.isPending).toBe(false)
    expect(result.current.isFetching).toBe(true)
    await act(async () => { reject(new Error('offline')) })
    await waitFor(() => expect(result.current.isRefetchError).toBe(true))
    expect(result.current.data).toEqual(cached)
    expect(result.current.isLoadingError).toBe(false)
    await act(async () => { client.setQueryData(['products', {}], []) })
    jest.mocked(connector.getProducts).mockRejectedValueOnce(new Error('503'))
    await act(async () => { await result.current.refetch() })
    expect(result.current.data).toEqual([])
    expect(result.current.isLoadingError).toBe(false)
  } finally {
    await unmount()
    client.clear()
  }
})

test('resume and reconnect refresh only stale domains and share an in-flight list request', async () => {
  const { client, connector, wrapper } = setup()
  const products = await connector.getProducts()
  const shopping = await connector.getShoppingItems()
  const receipts = await connector.getReceipts()
  const now = Date.now()
  client.setQueryData(['products', {}], products, { updatedAt: now - 31_000 })
  client.setQueryData(['shopping-items'], shopping, { updatedAt: now - 31_000 })
  client.setQueryData(['receipts'], receipts, { updatedAt: now - 31_000 })
  let resolveProducts!: (data: Product[]) => void
  const readProducts = jest.spyOn(connector, 'getProducts').mockImplementation(() => new Promise((resolve) => { resolveProducts = resolve }))
  const readShopping = jest.spyOn(connector, 'getShoppingItems')
  const readReceipts = jest.spyOn(connector, 'getReceipts')
  const readHousehold = jest.spyOn(connector, 'getHousehold')
  onlineManager.setOnline(false)
  const { result, unmount } = await renderHook(() => ({
    first: useProductsQuery(), second: useProductsQuery(),
    shopping: useShoppingItemsQuery(), receipts: useReceiptsQuery(),
  }), { wrapper })
  try {
    expect(result.current.first.data).toEqual(products)
    expect(readProducts).not.toHaveBeenCalled()
    await act(async () => {
      onlineManager.setOnline(true)
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(true)
    })
    await waitFor(() => expect(readProducts).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(readShopping).toHaveBeenCalledTimes(1))
    expect(readReceipts).not.toHaveBeenCalled()
    expect(readHousehold).not.toHaveBeenCalled()
    await act(async () => { resolveProducts(products) })
    await waitFor(() => expect(result.current.first.isFetching).toBe(false))
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
    })
    expect(readProducts).toHaveBeenCalledTimes(1)
    expect(readShopping).toHaveBeenCalledTimes(1)
    expect(readReceipts).not.toHaveBeenCalled()
  } finally {
    await unmount()
    client.clear()
  }
})

test('callers can override freshness and invalidation bypasses a fresh window', async () => {
  const { client, connector, wrapper } = setup()
  client.setQueryData(['household'], fakeHousehold)
  const read = jest.spyOn(connector, 'getHousehold')
  const { unmount } = await renderHook(() => useDomainQuery(['household'], (c) => c.getHousehold(), { staleTime: Infinity }), { wrapper })
  try {
    expect(read).not.toHaveBeenCalled()
    await act(async () => { await client.invalidateQueries({ queryKey: ['household'] }) })
    expect(read).toHaveBeenCalledTimes(1)
  } finally {
    await unmount()
    client.clear()
  }
})
