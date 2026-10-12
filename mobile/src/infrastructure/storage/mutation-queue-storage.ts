import type { QueueStorage, QueuedMutation } from '../../application/sync/mutation-queue.js'
import { createOfflineCacheStorage } from './offline-cache-storage.js'

const storage = createOfflineCacheStorage('garde-manger.mutation-queue-v1')

/** Queue writes must throw: reporting success after a failed write would lose user actions. */
export const mutationQueueStorage: QueueStorage = {
  async read() {
    const raw = await storage.read()
    if (!raw) return []
    const entries: unknown = JSON.parse(raw)
    if (!Array.isArray(entries) || !entries.every((entry) =>
      typeof entry?.id === 'number' && typeof entry?.entityId === 'string' &&
      ['products', 'shopping-items'].includes(entry?.collection) &&
      typeof entry?.scope?.server === 'string' && typeof entry?.scope?.userId === 'string' &&
      typeof entry?.scope?.householdId === 'string' && entry?.base?.id === entry.entityId &&
      (entry.patch === null || (typeof entry.patch === 'object' && entry.patch !== null)) &&
      typeof entry?.attempts === 'number' && typeof entry?.retryAt === 'number',
    )) throw new Error('Invalid mutation queue; preserving existing data')
    return entries as QueuedMutation[]
  },
  write: (entries) => Promise.resolve(storage.write(JSON.stringify(entries))),
}
