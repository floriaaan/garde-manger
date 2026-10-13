import { focusManager, onlineManager } from '@tanstack/react-query'
import { withOfflineMutations } from './offline-connector.js'
import { wireMutationQueue } from './wire-mutation-queue.js'
import type { QueuedMutation, QueueStorage } from './mutation-queue.js'
import { queryClient } from '../shared/query-client.js'
import { startOfflineCache } from '../shared/offline-cache.js'
import { HttpFridgeConnector } from '../../infrastructure/http/http-fridge-connector.js'
import { authClient } from '../../infrastructure/auth/auth-client.js'
import { fakeSession } from '../../infrastructure/fake/fixtures/session.fixture.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { fakeShoppingItems } from '../../infrastructure/fake/fixtures/shopping-item.fixture.js'
import { Result } from '../../domain/shared/result.js'

jest.mock('../shared/server-config.js', () => ({ getServerUrl: () => 'https://server.example' }))
jest.mock('../../infrastructure/auth/auth-client.js', () => ({
  authClient: {
    getCookie: jest.fn().mockResolvedValue(''),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}))

const originalFetch = globalThis.fetch
let stops: (() => void)[]

beforeEach(() => {
  jest.useFakeTimers()
  stops = []
  onlineManager.setOnline(true)
  focusManager.setFocused(true)
  jest.mocked(authClient.signOut).mockClear()
  queryClient.setQueryData(['session'], fakeSession)
  queryClient.setQueryData(['household'], fakeHousehold)
  queryClient.setQueryData(['shopping-items'], fakeShoppingItems)
})

afterEach(() => {
  stops.forEach((stop) => stop())
  queryClient.clear()
  globalThis.fetch = originalFetch
  onlineManager.setOnline(true)
  focusManager.setFocused(undefined)
  jest.useRealTimers()
})

function setup() {
  let disk: QueuedMutation[] = []
  const storage: QueueStorage = {
    read: async () => JSON.parse(JSON.stringify(disk)),
    write: async (entries) => { disk = JSON.parse(JSON.stringify(entries)) },
  }
  const boot = () => withOfflineMutations(new HttpFridgeConnector(), storage)
  return { ...boot(), boot, disk: () => disk }
}

function response(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body }
}

const outages = [
  ['HTTP 500', () => Promise.resolve(response(500, { error: { type: 'server_error', message: 'Unavailable' } }))],
  ['HTML 503', () => Promise.resolve({ status: 503, ok: false, json: async () => { throw new SyntaxError('HTML proxy response') } })],
  ['timeout', () => Promise.reject(Object.assign(new Error('Timed out'), { name: 'AbortError' }))],
] as const

test.each(outages)('%s preserves cached reads, session and durable writes until recovery', async (_name, fail) => {
  const s = setup()
  const fetchMock = jest.fn().mockImplementation(fail)
  globalThis.fetch = fetchMock
  await expect(queryClient.fetchQuery({
    queryKey: ['shopping-items'], queryFn: () => s.connector.getShoppingItems(), retry: false,
  })).rejects.toThrow()
  expect(queryClient.getQueryData(['shopping-items'])).toEqual(fakeShoppingItems)
  expect(queryClient.getQueryData(['session'])).toEqual(fakeSession)

  const item = fakeShoppingItems[0]
  expect(await s.connector.updateShoppingItem(item.id, { checked: true }))
    .toEqual(Result.ok({ ...item, checked: true }))
  // Replay now reads the authoritative row before attempting a versioned PATCH.
  fetchMock.mockImplementation((_url: string, init?: RequestInit) => init?.method === 'PATCH'
    ? fail() : Promise.resolve(response(200, { items: [item] })))
  await s.queue.flush()
  expect(s.disk()).toEqual([expect.objectContaining({ attempts: 1, retryAt: expect.any(Number) })])
  expect(s.disk()[0].error).toBeUndefined()
  expect(queryClient.getQueryData(['shopping-items'])).toContainEqual({ ...item, checked: true })
  expect(authClient.signOut).not.toHaveBeenCalled()

  // A new connector reads the serialized queue, including its retry deadline.
  const restarted = s.boot()
  await restarted.queue.flush()
  expect(fetchMock).toHaveBeenCalledTimes(3)
  fetchMock.mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(response(200,
    init?.method === 'PATCH' ? { item: { ...item, checked: true } } : { items: [item] })))
  await restarted.queue.flush(true)
  expect(s.disk()).toEqual([])
  expect(fetchMock.mock.calls[4]).toEqual([
    `https://server.example/api/shopping-items/${item.id}`,
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ checked: true, expectedUpdatedAt: item.updatedAt }) }),
  ])
  fetchMock.mockResolvedValue(response(200, { items: [{ ...item, checked: true }] }))
  await queryClient.fetchQuery({ queryKey: ['shopping-items'], queryFn: () => restarted.connector.getShoppingItems(), retry: false })
  expect(queryClient.getQueryData(['shopping-items'])).toEqual([{ ...item, checked: true }])
  expect(queryClient.getQueryData(['session'])).toEqual(fakeSession)
})

test('online → offline → online replays real queued HTTP writes on the reconnect signal', async () => {
  const s = setup()
  const item = fakeShoppingItems[0]
  const fetchMock = jest.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(response(200,
    init?.method === 'PATCH' ? { item: { ...item, checked: true } } : { items: [item] })))
  globalThis.fetch = fetchMock
  await s.queue.pending()
  stops.push(wireMutationQueue(s.queue, s.restorePending))
  await jest.advanceTimersByTimeAsync(0)
  onlineManager.setOnline(false)
  await s.connector.updateShoppingItem(item.id, { checked: true })
  await jest.advanceTimersByTimeAsync(10_000)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(s.disk()).toHaveLength(1)
  onlineManager.setOnline(true)
  await jest.advanceTimersByTimeAsync(0)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(s.disk()).toEqual([])
  await jest.advanceTimersByTimeAsync(10_000)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('a confirmed 401 revokes the session, clears the read snapshot and stops subsequent replay', async () => {
  const s = setup()
  let snapshot: string | null = null
  const cache = await startOfflineCache(queryClient, {
    read: async () => snapshot,
    write: async (value) => { snapshot = value },
    clear: async () => { snapshot = null },
  }, 'https://server.example', jest.fn())
  stops.push(cache.stop)
  queryClient.setQueryData(['shopping-items'], fakeShoppingItems)
  await jest.advanceTimersByTimeAsync(1000)
  expect(snapshot).not.toBeNull()
  await s.connector.deleteShoppingItem(fakeShoppingItems[0].id)
  await s.connector.deleteShoppingItem(fakeShoppingItems[1].id)
  const fetchMock = jest.fn().mockResolvedValue(response(401, {
    error: { type: 'unauthenticated', message: 'Revoked' },
  }))
  globalThis.fetch = fetchMock
  await s.queue.flush()
  await jest.advanceTimersByTimeAsync(1000)
  expect(queryClient.getQueryData(['session'])).toBeNull()
  expect(queryClient.getQueryData(['shopping-items'])).toBeUndefined()
  expect(snapshot).toBeNull()
  expect(authClient.signOut).toHaveBeenCalledTimes(1)
  expect(s.disk()[0].error?.type).toBe('unauthenticated')
  expect(s.disk()).toHaveLength(2)
  await s.queue.flush(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('pending fields overlay remote reads until a version conflict retains intent and exposes the server row', async () => {
  const s = setup()
  const item = fakeShoppingItems[0]
  const remote = { ...item, name: 'Renamed on another device', quantity: { amount: 5, unit: 'L' }, updatedAt: '2026-10-13T12:00:00.000Z' }
  const fetchMock = jest.fn().mockResolvedValue(response(200, { items: [remote] }))
  globalThis.fetch = fetchMock
  await s.connector.updateShoppingItem(item.id, { checked: true })
  expect(await s.connector.getShoppingItems()).toEqual([{ ...remote, checked: true }])
  await s.queue.flush()
  expect(queryClient.getQueryData(['shopping-items'])).toContainEqual(remote)
  expect(await s.connector.getShoppingItems()).toEqual([remote])
  expect(s.disk()).toEqual([expect.objectContaining({ patch: { checked: true }, error: expect.objectContaining({ type: 'sync_conflict' }) })])
  await s.queue.flush(true)
  expect(fetchMock.mock.calls.every(([, init]) => init?.method !== 'PATCH')).toBe(true)
})

test.each(['edit', 'delete'] as const)('remote deletion during a pending %s has an explicit outcome', async (action) => {
  const s = setup()
  const item = fakeShoppingItems[0]
  if (action === 'edit') await s.connector.updateShoppingItem(item.id, { checked: true })
  else await s.connector.deleteShoppingItem(item.id)
  globalThis.fetch = jest.fn().mockResolvedValue(action === 'edit'
    ? response(200, { items: [] })
    : response(404, { error: { type: 'shopping_item_not_found', message: 'Deleted on another device' } }))
  await s.queue.flush()
  await s.queue.flush(true)
  expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  if (action === 'delete') expect(s.disk()).toEqual([])
  else expect(s.disk()).toEqual([expect.objectContaining({ error: expect.objectContaining({ type: 'shopping_item_not_found' }) })])
  globalThis.fetch = jest.fn().mockResolvedValue(response(200, { items: [] }))
  expect(await s.connector.getShoppingItems()).toEqual([])
})
