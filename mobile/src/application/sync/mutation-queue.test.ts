import { MutationQueue, type QueuedMutation, type QueueStorage, type SyncScope } from './mutation-queue.js'
import { Result } from '../../domain/shared/result.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'
import type { ApiError } from '../../domain/shared/api-error.js'

const item: ShoppingItem = {
  id: 'milk', name: 'Milk', quantity: { amount: 1, unit: 'L' }, checked: false,
  source: 'manual', createdAt: '2026-10-12', updatedAt: '2026-10-12',
}
const initialScope: SyncScope = { server: 'https://server.example', userId: 'user', householdId: 'home' }

function setup() {
  let disk: QueuedMutation[] = []
  let scope: SyncScope | null = initialScope
  let time = 1000
  const storage: QueueStorage = {
    read: jest.fn(async () => JSON.parse(JSON.stringify(disk))),
    write: jest.fn(async (entries) => { disk = JSON.parse(JSON.stringify(entries)) }),
  }
  const send = jest.fn(async (_entry: QueuedMutation): Promise<Result<unknown, ApiError>> => Result.ok(undefined))
  const changed = jest.fn()
  const failed = jest.fn()
  const create = () => new MutationQueue(storage, () => scope, send, changed, failed, () => time)
  return { queue: create(), create, send, changed, failed, storage, disk: () => disk,
    setScope: (value: SyncScope | null) => { scope = value }, advance: (ms: number) => { time += ms } }
}

test('offline edits and deletes survive a restart and overlay stale or empty reads', async () => {
  const s = setup()
  expect(await s.queue.enqueue('shopping-items', item, { checked: true })).toEqual(Result.ok({ ...item, checked: true }))
  await s.queue.enqueue('shopping-items', { ...item, id: 'bread' }, null)
  expect(s.send).not.toHaveBeenCalled()
  const restarted = s.create()
  expect(await restarted.overlay('shopping-items', [item, { ...item, id: 'bread' }])).toEqual([{ ...item, checked: true }])
  expect(await restarted.overlay('shopping-items', [])).toEqual([{ ...item, checked: true }])
  await restarted.flush()
  await restarted.flush()
  expect(s.send).toHaveBeenCalledTimes(2)
  expect(s.disk()).toEqual([])
})

test('a lost response retries absolute assignments in order with persisted backoff', async () => {
  const s = setup()
  s.send.mockImplementationOnce(async () => Result.err({ type: 'network_error', message: 'Lost response' }))
  await s.queue.enqueue('shopping-items', item, { quantity: { amount: 2, unit: 'L' } })
  await s.queue.enqueue('shopping-items', item, { quantity: { amount: 3, unit: 'L' } })
  await s.queue.flush()
  const restarted = s.create()
  await restarted.flush()
  expect(s.send).toHaveBeenCalledTimes(1)
  s.advance(1000)
  await restarted.flush()
  expect(s.send.mock.calls.map(([entry]) => entry.patch)).toEqual([
    { quantity: { amount: 2, unit: 'L' } }, { quantity: { amount: 2, unit: 'L' } }, { quantity: { amount: 3, unit: 'L' } },
  ])
  expect(s.disk()).toEqual([])
})

test('reconnect forces retry and an already deleted entity completes successfully', async () => {
  const s = setup()
  s.send.mockImplementationOnce(async () => Result.err({ type: 'temporary_error', message: 'Unavailable' }))
  s.send.mockImplementationOnce(async () => Result.err({ type: 'shopping_item_not_found', message: 'Gone' }))
  await s.queue.enqueue('shopping-items', item, null)
  await s.queue.flush()
  await s.queue.flush(true)
  expect(s.disk()).toEqual([])
  expect(s.failed).not.toHaveBeenCalled()
})

test('permanent validation failures stop retrying, surface, and leave unrelated work runnable', async () => {
  const s = setup()
  s.send.mockImplementationOnce(async () => Result.err({ type: 'validation_failed', message: 'Invalid quantity' }))
  await s.queue.enqueue('shopping-items', item, { quantity: { amount: -1, unit: 'L' } })
  await s.queue.enqueue('shopping-items', { ...item, id: 'bread' }, { checked: true })
  await s.queue.flush()
  await s.queue.flush(true)
  expect(s.send).toHaveBeenCalledTimes(2)
  expect(s.failed).toHaveBeenCalledWith(expect.objectContaining({ error: { type: 'validation_failed', message: 'Invalid quantity' } }))
  expect(s.disk()).toHaveLength(1)
  expect(await s.queue.overlay('shopping-items', [item])).toEqual([item])
})

test.each(['server', 'userId', 'householdId'] as const)('never overlays or replays another %s scope', async (key) => {
  const s = setup()
  await s.queue.enqueue('shopping-items', item, { checked: true })
  s.setScope({ ...initialScope, [key]: 'different' })
  expect(await s.queue.overlay('shopping-items', [item])).toEqual([item])
  await s.queue.flush()
  expect(s.send).not.toHaveBeenCalled()
  s.setScope(initialScope)
  await s.queue.flush()
  expect(s.send).toHaveBeenCalledTimes(1)
})

test('a confirmed auth refusal is persisted and stops replay when the session disappears', async () => {
  const s = setup()
  s.send.mockImplementationOnce(async () => {
    s.setScope(null)
    return Result.err({ type: 'unauthenticated', message: 'Revoked' })
  })
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.enqueue('shopping-items', { ...item, id: 'bread' }, { checked: true })
  await s.queue.flush()
  expect(s.send).toHaveBeenCalledTimes(1)
  expect(s.failed).toHaveBeenCalledTimes(1)
  expect(s.disk()[0].error?.type).toBe('unauthenticated')
})

test('storage failures never report an accepted action or publish an optimistic update', async () => {
  const s = setup()
  jest.mocked(s.storage.write).mockRejectedValueOnce(new Error('Full disk'))
  const result = await s.queue.enqueue('shopping-items', item, { checked: true })
  expect(result).toEqual(Result.err({ type: 'storage_error', message: expect.any(String) }))
  expect(s.disk()).toEqual([])
  expect(s.changed).not.toHaveBeenCalled()
})

test('concurrent enqueues and overlapping replays do not lose or send duplicate entries', async () => {
  const s = setup()
  await Promise.all([
    s.queue.enqueue('shopping-items', item, { checked: true }),
    s.queue.enqueue('shopping-items', { ...item, id: 'bread' }, { checked: true }),
  ])
  expect(new Set(s.disk().map((entry) => entry.id)).size).toBe(2)
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  s.send.mockImplementationOnce(async () => { await pending; return Result.ok(undefined) })
  const first = s.queue.flush()
  await s.queue.flush()
  release()
  await first
  expect(s.send).toHaveBeenCalledTimes(2)
  expect(s.disk()).toEqual([])
})
