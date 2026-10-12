import { withOfflineMutations } from './offline-connector.js'
import { queryClient } from '../shared/query-client.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeShoppingItems } from '../../infrastructure/fake/fixtures/shopping-item.fixture.js'
import { fakeProducts } from '../../infrastructure/fake/fixtures/product.fixture.js'
import { fakeSession } from '../../infrastructure/fake/fixtures/session.fixture.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { Result } from '../../domain/shared/result.js'
import { subscribeToast } from '../shared/toast.js'
import type { QueuedMutation } from './mutation-queue.js'

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
