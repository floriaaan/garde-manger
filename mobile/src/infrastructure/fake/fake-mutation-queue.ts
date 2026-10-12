import { MutationQueue, type QueuedMutation, type SyncScope } from '../../application/sync/mutation-queue.js'
import { Result } from '../../domain/shared/result.js'
import { fakeSession } from './fixtures/session.fixture.js'
import { fakeHousehold } from './fixtures/household.fixture.js'
import { fakeProducts } from './fixtures/product.fixture.js'
import { fakeShoppingItems } from './fixtures/shopping-item.fixture.js'

/** In-memory preview data only; never overlays or replays against the fake inventory. */
export function createFakeMutationQueue(server: string, scope: () => SyncScope | null): MutationQueue {
  const fixtureScope = { server, userId: fakeSession.user.id, householdId: fakeHousehold.id }
  let entries: QueuedMutation[] = [
    { id: 1, scope: fixtureScope, collection: 'products', entityId: fakeProducts[0].id,
      base: fakeProducts[0], patch: { quantity: { amount: 2, unit: 'L' } }, attempts: 0, retryAt: 0 },
    { id: 2, scope: fixtureScope, collection: 'shopping-items', entityId: fakeShoppingItems[1].id,
      base: fakeShoppingItems[1], patch: { checked: true }, attempts: 1, retryAt: Date.now() + 60_000 },
    { id: 3, scope: fixtureScope, collection: 'shopping-items', entityId: fakeShoppingItems[3].id,
      base: fakeShoppingItems[3], patch: null, attempts: 0, retryAt: 0 },
    { id: 4, scope: fixtureScope, collection: 'products', entityId: fakeProducts[1].id,
      base: fakeProducts[1], patch: { location: 'freezer' }, attempts: 0, retryAt: 0,
      error: { type: 'sync_conflict', message: 'Demo conflict' } },
  ]
  return new MutationQueue({ read: async () => entries, write: async (next) => { entries = next } },
    scope, async () => Result.err({ type: 'network_error', message: 'Demo queue' }), () => {}, () => {})
}
