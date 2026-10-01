import { diagnosticAttributes, errorCode, errorStatus, failureLevel, safeOperation } from './log-diagnostic.js'

test('structured auth errors and numeric SQLSTATE codes retain stable diagnostics', () => {
  expect(errorCode({ code: 'SERVICE_UNAVAILABLE', statusCode: 503 })).toBe('SERVICE_UNAVAILABLE')
  expect(errorStatus({ status: 'SERVICE_UNAVAILABLE', statusCode: 503 })).toBe(503)
  expect(errorCode({ code: '42703' })).toBe('42703')
  expect(failureLevel('unauthenticated', 401)).toBe('info')
  expect(failureLevel('owner_cannot_leave', 409)).toBe('info')
  expect(failureLevel('unauthenticated', 503)).toBe('error')
  expect(failureLevel('validation_failed', 422)).toBe('warn')
})

test('messages, cyclic causes, stack paths and arbitrary labels cannot expose secrets', () => {
  const error: Error & { cause?: unknown } = new Error('password=supersecret alice@example.com')
  error.cause = error
  error.stack = 'Error: token=supersecret\n    at run (/Users/alice/private/session.ts:42:9)'
  const diagnostics = diagnosticAttributes(error)
  const text = JSON.stringify(diagnostics)
  expect(text).not.toContain('supersecret')
  expect(text).not.toContain('alice')
  expect(diagnostics['exception.stacktrace']).toBe('at session.ts:42:9')
  expect(safeOperation('GET /api/session?token=supersecret')).toBe('GET /api/session')
  expect(safeOperation('GET /api/alice@example.com')).toBe('redacted_operation')
})
