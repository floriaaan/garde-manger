import { act, renderHook } from '@testing-library/react-native'
import { MutationQueue } from './mutation-queue.js'
import { useSyncStatus } from './use-sync-status.js'
import { Result } from '../../domain/shared/result.js'
import { fakeShoppingItems } from '../../infrastructure/fake/fixtures/shopping-item.fixture.js'

jest.mock('../shared/server-config.js', () => ({ onServerUrlChange: () => () => {} }))

test('returns the observed snapshot so React Compiler cannot memoize a separate stale status read', async () => {
  const queue = new MutationQueue({ read: async () => [], write: async () => {} },
    () => ({ server: 'server', userId: 'user', householdId: 'home' }),
    async () => Result.ok(undefined), () => {}, () => {})
  await queue.pending()
  const view = await renderHook(() => useSyncStatus(queue))
  expect(view.result.current).toBe(queue.getSnapshot())
  await act(async () => { await queue.enqueue('shopping-items', fakeShoppingItems[0], { checked: true }) })
  expect(view.result.current.progress).toEqual({ done: 0, total: 1 })
  await act(async () => { await queue.flush() })
  expect(view.result.current).toBe(queue.getSnapshot())
  expect(view.result.current.progress).toEqual({ done: 1, total: 1 })
  await view.unmount()
})
