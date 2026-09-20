import { failureMessage, isRetryable, taskAge } from './job-labels.js'
import { makeJob } from './test-utils.js'

const now = new Date('2026-09-20T12:00:00Z')

test('taskAge speaks minutes, hours, then days', () => {
  expect(taskAge('2026-09-20T11:59:50Z', now)).toBe('à l’instant')
  expect(taskAge('2026-09-20T11:55:00Z', now)).toBe('il y a 5 min')
  expect(taskAge('2026-09-20T09:00:00Z', now)).toBe('il y a 3 h')
  expect(taskAge('2026-09-19T08:00:00Z', now)).toBe('hier')
})

test('quota and unconfigured provider are not retryable and say what to do', () => {
  const quota = makeJob({ status: 'failed', error: { type: 'ai_quota_exceeded', message: 'x' } })
  expect(isRetryable(quota)).toBe(false)
  expect(failureMessage(quota)).toContain('Quota')
  const other = makeJob({ status: 'failed', error: { type: 'timeout', message: 'x' } })
  expect(isRetryable(other)).toBe(true)
})
