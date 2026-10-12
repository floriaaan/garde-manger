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

test('a conflict retains dependent intent across restart and permits scoped dismissal', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'sync_conflict', message: 'Changed elsewhere' }))
  await s.queue.enqueue('shopping-items', item, { quantity: { amount: 2, unit: 'L' } })
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.enqueue('shopping-items', { ...item, id: 'bread' }, { checked: true })
  await s.queue.flush()
  const restarted = s.create()
  await restarted.flush(true)
  expect(s.send).toHaveBeenCalledTimes(2)
  expect(await restarted.overlay('shopping-items', [])).toEqual([])
  const failures = await restarted.failures()
  expect(failures).toHaveLength(2)
  expect(failures[0].patch).toEqual({ quantity: { amount: 2, unit: 'L' } })
  s.setScope({ ...initialScope, userId: 'other' })
  await restarted.discardFailure(failures[0].id)
  expect(s.disk()).toHaveLength(2)
  s.setScope(initialScope)
  await restarted.discardFailure(failures[0].id)
  expect(await restarted.failures()).toHaveLength(1)
})

test('acknowledged server versions advance later edits within the same replay', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.ok({ ...item, checked: true, updatedAt: 'next-version' }))
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.enqueue('shopping-items', item, { name: 'Milk edited' })
  await s.queue.flush()
  expect(s.send.mock.calls[1][0].base.updatedAt).toBe('next-version')
})

test('explicit recovery rebases retained edits onto a fresh server row', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'sync_conflict', message: 'Changed elsewhere' }))
  await s.queue.enqueue('shopping-items', item, { name: 'Local name' })
  await s.queue.enqueue('shopping-items', { ...item, name: 'Local name' }, { checked: true })
  await s.queue.flush()
  await s.queue.reapplyConflicts('shopping-items', { ...item, quantity: { amount: 7, unit: 'L' }, updatedAt: 'fresh-version' })
  expect(await s.queue.failures()).toEqual([])
  const restarted = s.create()
  expect(await restarted.overlay('shopping-items', [])).toEqual([
    { ...item, name: 'Local name', checked: true, quantity: { amount: 7, unit: 'L' }, updatedAt: 'fresh-version' },
  ])
})

test('a matching lost response cannot rebase later intent over unrelated remote changes', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.ok({ ...item, checked: true, quantity: { amount: 7, unit: 'L' }, updatedAt: 'remote-version' }))
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.enqueue('shopping-items', { ...item, checked: true }, { quantity: { amount: 3, unit: 'L' } })
  await s.queue.flush()
  expect(s.send.mock.calls[1][0].base.updatedAt).toBe(item.updatedAt)
})

test('cancellation persists and rebases later snapshots without removing their intent', async () => {
  const s = setup()
  await s.queue.enqueue('shopping-items', item, { quantity: { amount: 2, unit: 'L' } })
  await s.queue.enqueue('shopping-items', { ...item, quantity: { amount: 2, unit: 'L' } }, { checked: true })
  const [first] = await s.queue.pending()
  expect(await s.queue.cancel(first.id)).toEqual(Result.ok(undefined))
  const restarted = s.create()
  expect(await restarted.overlay('shopping-items', [])).toEqual([{ ...item, checked: true }])
  expect((await restarted.pending())[0].base.quantity.amount).toBe(1)
  await restarted.flush()
  expect(s.send).toHaveBeenCalledTimes(1)
  expect(s.send.mock.calls[0][0].patch).toEqual({ checked: true })
})

test('cancellation refuses another scope and preserves intent on storage failure', async () => {
  const s = setup()
  await s.queue.enqueue('shopping-items', item, { checked: true })
  const [entry] = await s.queue.pending()
  s.setScope({ ...initialScope, householdId: 'other' })
  expect(await s.queue.cancel(entry.id)).toEqual(Result.err(expect.objectContaining({ type: 'action_unavailable' })))
  s.setScope(initialScope)
  jest.mocked(s.storage.write).mockRejectedValueOnce(new Error('Full disk'))
  expect(await s.queue.cancel(entry.id)).toEqual(Result.err(expect.objectContaining({ type: 'storage_error' })))
  expect(await s.queue.pending()).toHaveLength(1)
  expect(s.disk()).toHaveLength(1)
})

test('an action being sent cannot be cancelled before its acknowledgement is persisted', async () => {
  const s = setup()
  await s.queue.enqueue('shopping-items', item, { checked: true })
  const [entry] = await s.queue.pending()
  let release!: () => void
  let started!: () => void
  const ready = new Promise<void>((resolve) => { started = resolve })
  const response = new Promise<void>((resolve) => { release = resolve })
  s.send.mockImplementationOnce(async () => { started(); await response; return Result.ok(undefined) })
  const replay = s.queue.flush()
  await ready
  expect(await s.queue.cancel(entry.id)).toEqual(Result.err(expect.objectContaining({ type: 'action_syncing' })))
  expect(await s.queue.pending()).toHaveLength(1)
  release()
  await replay
  expect(await s.queue.pending()).toEqual([])
})

test('replay waits for a pending cancellation write instead of sending removed intent', async () => {
  const s = setup()
  await s.queue.enqueue('shopping-items', item, { checked: true })
  const [entry] = await s.queue.pending()
  let release!: () => void
  let started!: () => void
  const ready = new Promise<void>((resolve) => { started = resolve })
  const writing = new Promise<void>((resolve) => { release = resolve })
  const persist = jest.mocked(s.storage.write).getMockImplementation()!
  jest.mocked(s.storage.write).mockImplementationOnce(async (entries) => { started(); await writing; await persist(entries) })
  const cancellation = s.queue.cancel(entry.id)
  await ready
  const replay = s.queue.flush()
  release()
  await cancellation
  await replay
  expect(s.send).not.toHaveBeenCalled()
  expect(s.disk()).toEqual([])
})

test('failed edits remain inspectable after restart and explicit retry sends the saved patch', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'forbidden', message: 'Denied' }))
  const patch = { checked: true }
  await s.queue.enqueue('shopping-items', item, patch)
  await s.queue.flush()
  const restarted = s.create()
  expect(await restarted.overlay('shopping-items', [item])).toEqual([item])
  expect((await restarted.failures())[0].patch).toEqual(patch)
  const entry = restarted.status().entries[0]
  expect(entry.error?.type).toBe('forbidden')
  await restarted.retry(entry.id)
  expect(s.send.mock.calls[1][0].patch).toEqual(patch)
  expect(restarted.status().entries).toEqual([])
})

test('status observes durable writes and actual delivery, but stays pending during backoff', async () => {
  const s = setup()
  const changed = jest.fn()
  const stop = s.queue.subscribe(changed)
  await s.queue.enqueue('shopping-items', item, null)
  expect(changed).toHaveBeenCalled()
  let release!: () => void
  let started!: () => void
  const sending = new Promise<void>((resolve) => { started = resolve })
  s.send.mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => { release = resolve; started() })
    return Result.err({ type: 'network_error', message: 'Unavailable' })
  })
  const flush = s.queue.flush()
  await sending
  expect(s.queue.status().syncing).toBe(true)
  release()
  await flush
  const after = changed.mock.calls.length
  await s.queue.flush()
  expect(s.queue.status().syncing).toBe(false)
  expect(s.queue.status().entries[0].attempts).toBe(1)
  expect(changed.mock.calls.length).toBe(after)
  await s.queue.retry()
  expect(s.queue.status().entries).toEqual([])
  stop()
})

test('another scope cannot inspect or retry a failed action; retry write failures retain it', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'forbidden', message: 'Denied' }))
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.flush()
  const id = s.disk()[0].id
  s.setScope({ ...initialScope, userId: 'someone-else' })
  expect(s.queue.status().entries).toEqual([])
  await s.queue.retry(id)
  expect(s.send).toHaveBeenCalledTimes(1)
  s.setScope(initialScope)
  jest.mocked(s.storage.write).mockRejectedValueOnce(new Error('Disk full'))
  await expect(s.queue.retry(id)).rejects.toThrow('Disk full')
  expect(s.disk()[0]).toMatchObject({ error: { type: 'forbidden' }, patch: { checked: true } })
  expect(s.send).toHaveBeenCalledTimes(1)
})

test('a failed edit blocks newer edits on its entity until retry, while unrelated actions continue', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'forbidden', message: 'Denied' }))
  await s.queue.enqueue('shopping-items', item, { quantity: { amount: 2, unit: 'L' } })
  await s.queue.enqueue('shopping-items', item, { quantity: { amount: 3, unit: 'L' } })
  await s.queue.enqueue('shopping-items', { ...item, id: 'bread' }, { checked: true })
  await s.queue.flush()
  expect(s.send.mock.calls.map(([entry]) => entry.entityId)).toEqual(['milk', 'bread'])
  await s.queue.flush(true)
  expect(s.send).toHaveBeenCalledTimes(2)
  expect((await s.queue.failures())[1].patch).toEqual({ quantity: { amount: 3, unit: 'L' } })
  const failed = s.queue.status().entries[0]
  await s.queue.retry(failed.id)
  expect(s.send.mock.calls.slice(2).map(([entry]) => entry.patch)).toEqual([
    { quantity: { amount: 2, unit: 'L' } }, { quantity: { amount: 3, unit: 'L' } },
  ])
  expect(s.queue.status().entries).toEqual([])
})


test.each(['sync_conflict', 'shopping_item_not_found'])('ordinary retry never bypasses %s recovery', async (type) => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type, message: 'Changed elsewhere' }))
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.flush()
  await s.queue.retry(s.disk()[0].id)
  expect(s.send).toHaveBeenCalledTimes(1)
  expect((await s.queue.failures())[0].patch).toEqual({ checked: true })
})


test('retrying a dependent failure first retries its earlier ordinary failure in order', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'forbidden', message: 'Denied' }))
  await s.queue.enqueue('shopping-items', item, { quantity: { amount: 2, unit: 'L' } })
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.flush()
  const dependent = (await s.queue.failures())[1]
  await s.queue.retry(dependent.id)
  expect(s.send.mock.calls.slice(1).map(([entry]) => entry.patch)).toEqual([
    { quantity: { amount: 2, unit: 'L' } }, { checked: true },
  ])
  expect(await s.queue.failures()).toEqual([])
})

test.each([{ name: 'Fresh edit' }, null])('retained conflicts permit fresh edits and deletion following #85 recovery: %j', async (patch) => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'sync_conflict', message: 'Changed elsewhere' }))
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.flush()
  await s.queue.enqueue('shopping-items', { ...item, updatedAt: 'fresh-version' }, patch)
  await s.queue.flush()
  expect(s.send).toHaveBeenCalledTimes(2)
  expect(s.send.mock.calls[1][0]).toMatchObject({ patch, base: { updatedAt: 'fresh-version' } })
  expect(await s.queue.failures()).toHaveLength(1)
})


test('overwrite invokes recovery only for a conflict in the current scope', async () => {
  let scope = initialScope
  const recover = jest.fn(async () => {})
  const send = jest.fn(async () => Result.err({ type: 'sync_conflict', message: 'Remote edit' }))
  const queue = new MutationQueue({ read: async () => [], write: async () => {} }, () => scope, send,
    () => {}, () => {}, Date.now, undefined, recover)
  await queue.enqueue('shopping-items', item, { checked: true })
  await queue.flush()
  const [conflict] = await queue.failures()
  scope = { ...initialScope, userId: 'other-user' }
  await queue.overwrite(conflict.id, 'reviewed-version')
  expect(recover).not.toHaveBeenCalled()
  scope = initialScope
  await queue.overwrite(conflict.id, 'reviewed-version')
  expect(recover).toHaveBeenCalledWith(expect.objectContaining({ id: conflict.id, patch: { checked: true } }), 'reviewed-version')
})


test('global progress counts only persisted acknowledgements and keeps conflicts incomplete', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.ok(undefined))
    .mockResolvedValueOnce(Result.err({ type: 'sync_conflict', message: 'Changed elsewhere' }))
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.enqueue('shopping-items', { ...item, id: 'bread' }, { name: 'Local bread' })
  expect(s.queue.status().progress).toEqual({ done: 0, total: 2 })
  await s.queue.flush()
  expect(s.queue.status().progress).toEqual({ done: 1, total: 2 })
  await s.queue.flush(true)
  expect(s.queue.status().progress).toEqual({ done: 1, total: 2 })
  s.setScope({ ...initialScope, userId: 'someone-else' })
  expect(s.queue.status().progress).toEqual({ done: 0, total: 0 })
  s.setScope(initialScope)
  const [conflict] = await s.queue.failures()
  await s.queue.cancel(conflict.id)
  expect(s.queue.status().progress).toEqual({ done: 1, total: 1 })
  await s.queue.enqueue('shopping-items', item, { checked: false })
  expect(s.queue.status().progress).toEqual({ done: 0, total: 1 })
})

test('cancellations resolve work without counting it as synchronized and reset for the next batch', async () => {
  const s = setup()
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.enqueue('shopping-items', { ...item, id: 'other' }, { checked: true })
  const [first] = await s.queue.pending()
  jest.mocked(s.storage.write).mockRejectedValueOnce(new Error('Disk full'))
  expect((await s.queue.cancel(first.id)).ok).toBe(false)
  expect(s.queue.status().cancelled).toBe(0)
  expect((await s.queue.cancel(first.id)).ok).toBe(true)
  expect(s.queue.status().progress).toEqual({ done: 0, total: 2 })
  expect(s.queue.status().cancelled).toBe(1)
  await s.queue.flush()
  expect(s.queue.status().progress).toEqual({ done: 1, total: 2 })
  s.setScope(null)
  expect(s.queue.status().cancelled).toBe(0)
  s.setScope(initialScope)
  expect(s.queue.status().cancelled).toBe(1)
  await s.queue.enqueue('shopping-items', item, { checked: true })
  expect(s.queue.status().cancelled).toBe(0)
  expect(s.queue.status().progress).toEqual({ done: 0, total: 1 })
})

test('automatic replay and general retry leave authentication refusals for explicit session recovery', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'unauthenticated', message: 'Expired' }))
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.flush()
  const [failure] = await s.queue.failures()
  await s.queue.flush(true)
  await s.queue.retry()
  expect(s.send).toHaveBeenCalledTimes(1)
  await s.queue.retry(failure.id)
  expect(s.send).toHaveBeenCalledTimes(2)
  expect(s.queue.status().progress.done).toBe(1)
})

test('failed acknowledgement persistence never increments progress', async () => {
  const s = setup()
  await s.queue.enqueue('shopping-items', item, { checked: true })
  jest.mocked(s.storage.write).mockRejectedValueOnce(new Error('Disk full'))
  await expect(s.queue.flush()).rejects.toThrow('Disk full')
  expect(s.queue.status().progress).toEqual({ done: 0, total: 1 })
})


test('status snapshots stay stable between changes and expose delivery progress directly to observers', async () => {
  const s = setup()
  await s.queue.pending()
  const initial = s.queue.getSnapshot()
  expect(s.queue.getSnapshot()).toBe(initial)
  await s.queue.enqueue('shopping-items', item, { checked: true })
  const pending = s.queue.getSnapshot()
  expect(pending).not.toBe(initial)
  expect(pending.progress).toEqual({ done: 0, total: 1 })
  expect(s.queue.getSnapshot()).toBe(pending)
  await s.queue.flush()
  const completed = s.queue.getSnapshot()
  expect(completed).not.toBe(pending)
  expect(completed.progress).toEqual({ done: 1, total: 1 })
  expect(s.queue.getSnapshot()).toBe(completed)
  s.setScope({ ...initialScope, userId: 'someone-else' })
  expect(s.queue.getSnapshot().progress).toEqual({ done: 0, total: 0 })
})


test('idle or blocked replay preserves the observable snapshot without notifying subscribers', async () => {
  const s = setup()
  await s.queue.pending()
  const changed = jest.fn()
  const stop = s.queue.subscribe(changed)
  const empty = s.queue.getSnapshot()
  await s.queue.flush()
  await s.queue.flush(true)
  expect(s.queue.getSnapshot()).toBe(empty)
  expect(changed).not.toHaveBeenCalled()
  s.send.mockResolvedValueOnce(Result.err({ type: 'sync_conflict', message: 'Remote edit' }))
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.flush()
  const blocked = s.queue.getSnapshot()
  changed.mockClear()
  await s.queue.flush(true)
  expect(s.queue.getSnapshot()).toBe(blocked)
  expect(changed).not.toHaveBeenCalled()
  stop()
})

test.each(['server', 'userId', 'householdId'] as const)('switching %s during replay ignores the old response and stops the next write', async (key) => {
  const s = setup()
  await s.queue.enqueue('shopping-items', item, { checked: true })
  await s.queue.enqueue('shopping-items', { ...item, id: 'bread' }, { checked: true })
  s.changed.mockClear()
  let finish!: () => void
  const response = new Promise<void>((resolve) => { finish = resolve })
  let started!: () => void
  const sending = new Promise<void>((resolve) => { started = resolve })
  s.send.mockImplementationOnce(async () => {
    started()
    await response
    return Result.ok(undefined)
  })
  const replay = s.queue.flush()
  await sending
  s.setScope({ ...initialScope, [key]: 'different' })
  finish()
  await replay
  expect(s.send).toHaveBeenCalledTimes(1)
  expect(s.changed).not.toHaveBeenCalled()
  expect(s.disk()).toHaveLength(1)
  expect(await s.queue.pending()).toEqual([])
  s.setScope(initialScope)
  await s.create().flush()
  expect(s.send).toHaveBeenCalledTimes(2)
  expect(s.disk()).toEqual([])
})
