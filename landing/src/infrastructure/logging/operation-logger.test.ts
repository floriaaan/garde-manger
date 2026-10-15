import { afterEach, expect, test, vi } from 'vitest'
import { operationLogger } from './operation-logger.js'

afterEach(() => vi.restoreAllMocks())

test('records a failure without exposing its message and rethrows the same error', async () => {
  const sink = vi.spyOn(console, 'error').mockImplementation(() => {})
  const error = new Error('alice@example.com password=secret')
  await expect(operationLogger.run('landing.subscribe_to_waitlist', async () => { throw error })).rejects.toBe(error)
  expect(sink).toHaveBeenCalledWith('operation completed', expect.objectContaining({
    'app.operation': 'landing.subscribe_to_waitlist', 'event.outcome': 'failure',
    'client.platform': 'landing',
    'error.code': 'operation_failed', durationMs: expect.any(Number),
  }))
  expect(JSON.stringify(sink.mock.calls)).not.toContain('alice@example.com')
  expect(JSON.stringify(sink.mock.calls)).not.toContain('secret')
})

test('a broken log sink does not turn a successful operation into an error', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => { throw new Error('sink unavailable') })
  await expect(operationLogger.run('landing.get_content', async () => 'content', { locale: 'fr' })).resolves.toBe('content')
})
