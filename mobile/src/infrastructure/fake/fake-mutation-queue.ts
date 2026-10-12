import type { QueuedMutation, QueueStorage } from '../../application/sync/mutation-queue.js'
import { fakeSession } from './fixtures/session.fixture.js'
import { fakeHousehold } from './fixtures/household.fixture.js'
import { fakeProducts } from './fixtures/product.fixture.js'
import { fakeShoppingItems } from './fixtures/shopping-item.fixture.js'

/** The fake server and its queued fixture actions share the same in-memory lifetime. */
export function createFakeMutationQueueStorage(server: string): QueueStorage {
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
      error: { type: 'sync_conflict', message: 'Cet élément a changé sur un autre appareil.' } },
    { id: 5, scope: fixtureScope, collection: 'products', entityId: fakeProducts[2].id,
      base: fakeProducts[2], patch: { quantity: { amount: 6, unit: 'unités' } }, attempts: 0, retryAt: 0 },
    { id: 6, scope: fixtureScope, collection: 'products', entityId: fakeProducts[3].id,
      base: fakeProducts[3], patch: { location: 'freezer', openedAt: new Date().toISOString() }, attempts: 0, retryAt: 0 },
    { id: 7, scope: fixtureScope, collection: 'products', entityId: fakeProducts[4].id,
      base: fakeProducts[4], patch: { quantity: { amount: 500, unit: 'g' } }, attempts: 2, retryAt: Date.now() + 120_000 },
    { id: 8, scope: fixtureScope, collection: 'products', entityId: fakeProducts[5].id,
      base: fakeProducts[5], patch: { price: 3.6 }, attempts: 0, retryAt: 0 },
    { id: 9, scope: fixtureScope, collection: 'shopping-items', entityId: fakeShoppingItems[0].id,
      base: fakeShoppingItems[0], patch: { quantity: { amount: 3, unit: 'L' } }, attempts: 0, retryAt: 0 },
    { id: 10, scope: fixtureScope, collection: 'shopping-items', entityId: fakeShoppingItems[2].id,
      base: fakeShoppingItems[2], patch: { checked: false, quantity: { amount: 12, unit: 'unités' } }, attempts: 0, retryAt: 0 },
    { id: 11, scope: fixtureScope, collection: 'shopping-items', entityId: fakeShoppingItems[4].id,
      base: fakeShoppingItems[4], patch: { quantity: { amount: 2, unit: 'bouteille' } }, attempts: 0, retryAt: 0,
      error: { type: 'sync_conflict', message: 'Cet élément a changé sur un autre appareil.' } },
    { id: 12, scope: fixtureScope, collection: 'products', entityId: fakeProducts[5].id,
      base: fakeProducts[5], patch: { name: 'Riz basmati complet' }, attempts: 0, retryAt: 0,
      error: { type: 'sync_conflict', message: 'Cet élément a changé sur un autre appareil.' } },
  ]
  return { read: async () => entries, write: async (next) => { entries = next } }
}
