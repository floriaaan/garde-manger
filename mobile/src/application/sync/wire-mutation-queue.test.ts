import { focusManager, onlineManager } from '@tanstack/react-query'
import { MutationQueue } from './mutation-queue.js'
import { wireMutationQueue } from './wire-mutation-queue.js'
import { queryClient } from '../shared/query-client.js'
import { Result } from '../../domain/shared/result.js'
import * as telemetryModule from '../shared/telemetry.js'

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
  jest.restoreAllMocks()
})

test('reports restore and flush failures once per failure period, retaining their cause', async () => {
  const recordError = jest.fn()
  jest.spyOn(telemetryModule, 'getTelemetry').mockReturnValue({ recordError })
  const error = new Error('Storage unavailable')
  const queue = new MutationQueue({ read: async () => [], write: async () => {} },
    () => null, async () => Result.ok(undefined), jest.fn(), jest.fn())
  const flush = jest.spyOn(queue, 'flush').mockRejectedValue(error)
  const restore = jest.fn().mockRejectedValue(error)
  onlineManager.setOnline(true)
  const stop = wireMutationQueue(queue, restore)
  try {
    await jest.advanceTimersByTimeAsync(10_000)
    queryClient.setQueryData(['household'], { id: 'home' })
    await jest.advanceTimersByTimeAsync(0)
    expect(recordError).toHaveBeenCalledTimes(2)
    expect(recordError.mock.calls.map(([, options]) => options.attributes['app.operation']).sort()).toEqual(['sync.flush', 'sync.restore'])
    expect(recordError.mock.calls.every(([, options]) => options.error === error)).toBe(true)
    flush.mockResolvedValue(undefined)
    restore.mockResolvedValue(undefined)
    queryClient.setQueryData(['household'], { id: 'recovered' })
    await jest.advanceTimersByTimeAsync(0)
    flush.mockRejectedValue(error)
    restore.mockRejectedValue(error)
    queryClient.setQueryData(['household'], { id: 'failed-again' })
    await jest.advanceTimersByTimeAsync(0)
    expect(recordError).toHaveBeenCalledTimes(4)
  } finally { stop() }
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
