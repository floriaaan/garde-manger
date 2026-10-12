import { focusManager, onlineManager } from '@tanstack/react-query'
import { MutationQueue } from './mutation-queue.js'
import { wireMutationQueue } from './wire-mutation-queue.js'
import { queryClient } from '../shared/query-client.js'
import { Result } from '../../domain/shared/result.js'

beforeEach(() => {
  jest.useFakeTimers()
  onlineManager.setOnline(false)
  focusManager.setFocused(true)
})
afterEach(() => {
  queryClient.clear()
  onlineManager.setOnline(true)
  focusManager.setFocused(undefined)
  jest.useRealTimers()
})

test('reuses online/focus signals, waits offline and in background, and cleans up subscriptions', async () => {
  const queue = new MutationQueue({ read: async () => [], write: async () => {} },
    () => null, async () => Result.ok(undefined), jest.fn(), jest.fn())
  const flush = jest.spyOn(queue, 'flush').mockResolvedValue(undefined)
  const restore = jest.fn(async () => {})
  const stop = wireMutationQueue(queue, restore)
  try {
    await jest.advanceTimersByTimeAsync(10_000)
    expect(flush).not.toHaveBeenCalled()
    onlineManager.setOnline(true)
    expect(flush).toHaveBeenLastCalledWith(true)
    flush.mockClear()
    focusManager.setFocused(false)
    await jest.advanceTimersByTimeAsync(10_000)
    expect(flush).not.toHaveBeenCalled()
    focusManager.setFocused(true)
    expect(flush).toHaveBeenLastCalledWith(true)
    queryClient.setQueryData(['household'], { id: 'home' })
    expect(restore).toHaveBeenCalledTimes(2)
    stop()
    flush.mockClear()
    restore.mockClear()
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    queryClient.setQueryData(['household'], { id: 'another' })
    await jest.advanceTimersByTimeAsync(10_000)
    expect(flush).not.toHaveBeenCalled()
    expect(restore).not.toHaveBeenCalled()
  } finally { stop() }
})
