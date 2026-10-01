// `http-client.js` (required below, inside `loadModules`) reads the session
// cookie via `authClient.getCookie()` on every request. The real client
// pulls in `better-auth/react`, an ESM-only package Jest can't parse
// without this module being replaced first — same convention as
// `http-fridge-connector.test.ts`.
jest.mock('../auth/auth-client.js', () => ({
  authClient: { getCookie: jest.fn().mockResolvedValue('') },
}))

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env = { ...originalEnv }
  jest.useRealTimers()
})

/**
 * The telemetry client is a module singleton that reads its configuration
 * once, at `start()`. Each test therefore needs a fresh module registry —
 * `require` inside `resetModules`, not a dynamic `import`, which jest's CJS
 * runtime refuses without `--experimental-vm-modules`.
 */
function loadModules(enabled: boolean) {
  jest.resetModules()
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test'
  process.env.EXPO_PUBLIC_TELEMETRY_ENABLED = enabled ? 'true' : 'false'
  const { telemetry } = require('./telemetry.js') as typeof import('./telemetry.js')
  const { apiFetch } = require('../http/http-client.js') as typeof import('../http/http-client.js')
  return { telemetry, apiFetch }
}

test('no traceparent header is sent while telemetry is disabled', async () => {
  const { telemetry, apiFetch } = loadModules(false)
  telemetry.start()

  const fetchMock = jest.fn().mockResolvedValue({ status: 204, ok: true })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  await apiFetch('/api/households/mine')

  const [, init] = fetchMock.mock.calls[0]
  expect(init.headers.traceparent).toBeUndefined()
})

test('an enabled client injects a well-formed W3C traceparent', async () => {
  const { telemetry, apiFetch } = loadModules(true)
  telemetry.start()

  const fetchMock = jest.fn().mockResolvedValue({ status: 204, ok: true })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  await apiFetch('/api/households/mine')

  const [, init] = fetchMock.mock.calls[0]
  expect(init.headers.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/)
  telemetry.shutdown()
})

test('a request still succeeds when the telemetry export throws', async () => {
  const { telemetry, apiFetch } = loadModules(true)
  telemetry.start()

  const fetchMock = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/api/telemetry/')) return Promise.reject(new Error('collector down'))
    return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ ok: 1 }) })
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const result = await apiFetch<{ ok: number }>('/api/households/mine')
  // Force the batch out: the collector rejects it, and nothing propagates.
  telemetry.shutdown()
  await new Promise<void>((resolve) => setImmediate(() => resolve()))

  expect(result).toEqual({ ok: true, value: { ok: 1 } })
})


function logRecords(fetchMock: jest.Mock) {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/logs'))
    .flatMap(([, init]) => JSON.parse(init.body).resourceLogs[0].scopeLogs[0].logRecords)
}

test('expected refusals aggregate occurrences; distinct technical failures stay ERROR and redact secrets', async () => {
  const { telemetry } = loadModules(true)
  telemetry.start()
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202 })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  for (let index = 0; index < 3; index += 1) telemetry.recordError('no household', {
    attributes: { 'error.code': 'no_household', 'app.operation': 'identity.get_household', 'http.response.status_code': 403 },
  })
  telemetry.recordError('owner refusal', { attributes: { 'error.code': 'owner_cannot_leave', 'app.operation': 'identity.leave_household' } })
  for (let index = 0; index < 2; index += 1) telemetry.recordError('password=supersecret', {
    error: { name: 'TypeError', message: 'token=supersecret alice@example.com', cause: { code: 'ECONNREFUSED', message: 'fetch failed' } },
    attributes: { 'app.operation': 'identity.get_session', 'error.code': 'session_fetch_failed', password: 'supersecret' },
  })
  telemetry.shutdown()
  await new Promise<void>((resolve) => setImmediate(resolve))
  const records = logRecords(fetchMock)
  expect(records).toHaveLength(4)
  expect(records.map((record) => record.severityText)).toEqual(['INFO', 'INFO', 'ERROR', 'ERROR'])
  expect(records[0].attributes).toContainEqual({ key: 'event.occurrences', value: { intValue: 3 } })
  const emitted = JSON.stringify(fetchMock.mock.calls)
  expect(emitted).not.toContain('supersecret')
  expect(emitted).not.toContain('alice@example.com')
  expect(emitted).toContain('ECONNREFUSED')
  expect(emitted).toContain('StructuredError')
})

test('a successful trace export is not repeated when only logs fail', async () => {
  const { telemetry } = loadModules(true)
  telemetry.start()
  let logAttempts = 0
  const fetchMock = jest.fn().mockImplementation((url: string) => Promise.resolve({ status: 202,
    ok: !url.endsWith('/logs') || ++logAttempts > 1,
  }))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  telemetry.startClientSpan('identity.get_session')?.end()
  telemetry.recordError('session failure', { attributes: { 'error.code': 'session_fetch_failed', 'app.operation': 'identity.get_session' } })
  telemetry.shutdown()
  await new Promise<void>((resolve) => setImmediate(resolve))
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000)
  telemetry.shutdown()
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/traces'))).toHaveLength(1)
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/logs'))).toHaveLength(2)
  now.mockRestore()
})
