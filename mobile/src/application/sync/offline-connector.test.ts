import { withOfflineMutations } from './offline-connector.js'
import { queryClient } from '../shared/query-client.js'
import { createFakeMutationQueueStorage } from '../../infrastructure/fake/fake-mutation-queue.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeShoppingItems } from '../../infrastructure/fake/fixtures/shopping-item.fixture.js'
import { fakeProducts } from '../../infrastructure/fake/fixtures/product.fixture.js'
import { fakeSession } from '../../infrastructure/fake/fixtures/session.fixture.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { Result } from '../../domain/shared/result.js'
import { subscribeToast } from '../shared/toast.js'
import type { QueuedMutation } from './mutation-queue.js'
import { startOfflineCache } from '../shared/offline-cache.js'

jest.mock('../shared/server-config.js', () => ({ getServerUrl: () => 'https://server.example' }))

afterEach(() => queryClient.clear())

function setup() {
  let disk: QueuedMutation[] = []
  const storage = { read: async () => JSON.parse(JSON.stringify(disk)), write: async (entries: QueuedMutation[]) => { disk = JSON.parse(JSON.stringify(entries)) } }
  queryClient.setQueryData(['session'], fakeSession)
  queryClient.setQueryData(['household'], fakeHousehold)
  queryClient.setQueryData(['shopping-items'], fakeShoppingItems)
  queryClient.setQueryData(['products', {}], fakeProducts)
  const raw = new FakeFridgeConnector()
  const sendItem = jest.spyOn(raw, 'updateShoppingItem')
  const sendProduct = jest.spyOn(raw, 'updateProduct')
  const offline = withOfflineMutations(raw, storage)
  return { ...offline, storage, sendItem, sendProduct, disk: () => disk }
}

test('supported writes update query data offline, and later replay through the original connector', async () => {
  const s = setup()
  const item = fakeShoppingItems[0]
  const product = fakeProducts[0]
  await s.connector.updateShoppingItem(item.id, { checked: true })
  await s.connector.updateProduct(product.id, { name: 'Updated' })
  expect(s.sendItem).not.toHaveBeenCalled()
  expect(s.sendProduct).not.toHaveBeenCalled()
  expect(queryClient.getQueryData(['shopping-items'])).toContainEqual({ ...item, checked: true })
  expect(queryClient.getQueryData(['product', product.id])).toEqual({ ...product, name: 'Updated' })
  await s.queue.flush()
  expect(s.sendItem).toHaveBeenCalledTimes(1)
  expect(s.sendProduct).toHaveBeenCalledTimes(1)
  expect(s.disk()).toEqual([])
})

test('restart hydrates pending rows without network and preserves unrelated cached products', async () => {
  const s = setup()
  const product = fakeProducts[0]
  await s.connector.updateProduct(product.id, { name: 'Updated' })
  queryClient.removeQueries({ queryKey: ['product'] })
  queryClient.setQueryData(['products', {}], fakeProducts)
  const restarted = withOfflineMutations(new FakeFridgeConnector(), s.storage)
  await restarted.restorePending()
  expect(queryClient.getQueryData(['products', {}])).toEqual(fakeProducts.map((row) => row.id === product.id ? { ...row, name: 'Updated' } : row))
  expect(queryClient.getQueryData(['product', product.id])).toEqual({ ...product, name: 'Updated' })
})

test('offline location changes move a product between filtered cached lists', async () => {
  const s = setup()
  const product = fakeProducts[0]
  queryClient.setQueryData(['products', { location: 'fridge' }], [product])
  queryClient.setQueryData(['products', { location: 'freezer' }], [])
  await s.connector.updateProduct(product.id, { location: 'freezer' })
  expect(queryClient.getQueryData(['products', { location: 'fridge' }])).toEqual([])
  expect(queryClient.getQueryData(['products', { location: 'freezer' }])).toEqual([{ ...product, location: 'freezer' }])
})

test('cold start restores the local-first read snapshot before applying durable pending mutations', async () => {
  jest.useFakeTimers()
  const s = setup()
  let snapshot: string | null = null
  const cacheStorage = {
    read: async () => snapshot,
    write: async (value: string) => { snapshot = value },
    clear: async () => { snapshot = null },
  }
  const stops: (() => void)[] = []
  try {
    const first = await startOfflineCache(queryClient, cacheStorage, 'https://server.example', jest.fn())
    stops.push(first.stop)
    // Simulate a crash before the read persister saves the newest optimistic change.
    queryClient.setQueryData(['shopping-items'], fakeShoppingItems)
    await jest.advanceTimersByTimeAsync(1000)
    first.stop()
    await s.connector.updateShoppingItem(fakeShoppingItems[0].id, { checked: true })
    queryClient.clear()
    const second = await startOfflineCache(queryClient, cacheStorage, 'https://server.example', jest.fn())
    stops.push(second.stop)
    const restarted = withOfflineMutations(new FakeFridgeConnector(), s.storage)
    await restarted.restorePending()
    expect(queryClient.getQueryData(['session'])).toEqual(fakeSession)
    expect(queryClient.getQueryData(['shopping-items'])).toEqual(fakeShoppingItems.map((row, index) =>
      index === 0 ? { ...row, checked: true } : row,
    ))
    expect(s.sendItem).not.toHaveBeenCalled()
  } finally {
    stops.forEach((stop) => stop())
    jest.useRealTimers()
  }
})

test('pending writes are refused when the cached account is not a household member', async () => {
  const s = setup()
  queryClient.setQueryData(['household'], { ...fakeHousehold, members: [] })
  const result = await s.connector.updateShoppingItem(fakeShoppingItems[0].id, { checked: true })
  expect(result.ok).toBe(false)
  expect(s.disk()).toEqual([])
})

test('a rejected deletion restores its row, reports the failure, and retains it for diagnosis', async () => {
  const s = setup()
  const item = fakeShoppingItems[0]
  const toast = jest.fn()
  const stop = subscribeToast(toast)
  // Use a separate connector so the queue captures the refusal before wrapping.
  const raw = new FakeFridgeConnector()
  jest.spyOn(raw, 'deleteShoppingItem').mockResolvedValue(Result.err({ type: 'forbidden', message: 'Denied' }))
  const offline = withOfflineMutations(raw, s.storage)
  await offline.connector.deleteShoppingItem(item.id)
  expect(queryClient.getQueryData(['shopping-items'])).not.toContainEqual(item)
  await offline.queue.flush()
  expect(queryClient.getQueryData(['shopping-items'])).toContainEqual(item)
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Denied') }))
  expect(s.disk()[0].error?.type).toBe('forbidden')
  stop()
})


test('remote quantity changes preserve server state and both local intents', async () => {
  const s = setup()
  const item = fakeShoppingItems[0]
  const remote = { ...item, quantity: { ...item.quantity, amount: 7 }, updatedAt: 'remote-version' }
  const raw = new FakeFridgeConnector()
  jest.spyOn(raw, 'getShoppingItems').mockResolvedValue([remote])
  const send = jest.spyOn(raw, 'updateShoppingItem')
  const offline = withOfflineMutations(raw, s.storage)
  await offline.connector.updateShoppingItem(item.id, { quantity: { ...item.quantity, amount: 3 } })
  await offline.connector.updateShoppingItem(item.id, { name: 'Local name' })
  await offline.queue.flush()
  expect(send).not.toHaveBeenCalled()
  expect(queryClient.getQueryData(['shopping-items'])).toContainEqual(remote)
  expect(await offline.queue.failures()).toHaveLength(2)
})

test('remote deletions never restore local rows on replay or restart', async () => {
  const s = setup()
  const item = fakeShoppingItems[0]
  const raw = new FakeFridgeConnector()
  jest.spyOn(raw, 'getShoppingItems').mockResolvedValue([])
  const offline = withOfflineMutations(raw, s.storage)
  await offline.connector.updateShoppingItem(item.id, { name: 'Local name' })
  await offline.connector.updateShoppingItem(item.id, { checked: true })
  await offline.queue.flush()
  expect(queryClient.getQueryData(['shopping-items'])).not.toContainEqual(expect.objectContaining({ id: item.id }))
  queryClient.setQueryData(['shopping-items'], fakeShoppingItems)
  const restarted = withOfflineMutations(raw, s.storage)
  await restarted.restorePending()
  expect(queryClient.getQueryData(['shopping-items'])).not.toContainEqual(expect.objectContaining({ id: item.id }))
  expect(await restarted.connector.getShoppingItems()).toEqual([])
  expect(await restarted.queue.failures()).toHaveLength(2)
})

test('a lost acknowledgement recognizes applied fields without resending the write', async () => {
  const s = setup()
  const item = fakeShoppingItems[0]
  const raw = new FakeFridgeConnector()
  let current = item
  jest.spyOn(raw, 'getShoppingItems').mockImplementation(async () => [current])
  const send = jest.spyOn(raw, 'updateShoppingItem').mockImplementationOnce(async (_id, patch) => {
    expect(patch.expectedUpdatedAt).toBe(item.updatedAt)
    current = { ...item, name: 'Applied', updatedAt: 'committed-version' }
    return Result.err({ type: 'network_error', message: 'Response lost' })
  })
  const offline = withOfflineMutations(raw, s.storage)
  await offline.connector.updateShoppingItem(item.id, { name: 'Applied' })
  await offline.queue.flush()
  await offline.queue.flush(true)
  expect(send).toHaveBeenCalledTimes(1)
  expect(s.disk()).toEqual([])
})


test('fake fixture actions use normal overlays, replay and subsequent local writes', async () => {
  queryClient.setQueryData(['session'], fakeSession)
  queryClient.setQueryData(['household'], fakeHousehold)
  queryClient.setQueryData(['products', {}], fakeProducts)
  queryClient.setQueryData(['shopping-items'], fakeShoppingItems)
  const raw = new FakeFridgeConnector()
  const getServerProducts = raw.getProducts.bind(raw)
  const getServerItems = raw.getShoppingItems.bind(raw)
  const offline = withOfflineMutations(raw, createFakeMutationQueueStorage('https://server.example'))
  await offline.restorePending()
  expect(queryClient.getQueryData(['product', fakeProducts[0].id])).toEqual(expect.objectContaining({ quantity: { amount: 2, unit: 'L' } }))
  expect((await getServerProducts()).find((row) => row.id === fakeProducts[0].id)?.quantity.amount).toBe(1)
  await offline.queue.flush(true)
  expect(await offline.queue.pending()).toEqual([])
  expect(await offline.queue.failures()).toHaveLength(1)
  expect((await getServerProducts()).find((row) => row.id === fakeProducts[0].id)?.quantity.amount).toBe(2)
  expect((await getServerItems()).some((row) => row.id === fakeShoppingItems[3].id)).toBe(false)
  const current = (await getServerProducts()).find((row) => row.id === fakeProducts[0].id)!
  queryClient.setQueryData(['product', current.id], current)
  await offline.connector.updateProduct(current.id, { name: 'New local edit' })
  expect(await offline.queue.pending()).toHaveLength(1)
  await offline.queue.flush(true)
  expect((await getServerProducts()).find((row) => row.id === current.id)?.name).toBe('New local edit')
})
