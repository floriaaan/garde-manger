import { authClient } from '../auth/auth-client.js'
import { apiFetch, apiFetchMultipart } from './http-client.js'
import { queryClient } from '../../application/shared/query-client.js'
import { telemetry } from '../telemetry/telemetry.js'
import { subscribeToast } from '../../application/shared/toast.js'

// `http-client.ts` reads the session cookie via `authClient.getCookie()` on
// every request. The real client pulls in `better-auth/react`, an ESM-only
// package Jest can't parse without this module being replaced first — same
// convention as `http-fridge-connector.test.ts`.
jest.mock('../auth/auth-client.js', () => ({
  authClient: { getCookie: jest.fn().mockResolvedValue(''), signOut: jest.fn().mockResolvedValue(undefined) },
}))

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  queryClient.clear()
})

test('apiFetch() resolves Result.ok(undefined) on a 204 response without parsing a body', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 204,
    ok: true,
    json: () => Promise.reject(new Error('should not be called on 204')),
  }) as unknown as typeof fetch

  const result = await apiFetch<void>('/api/products/some-id', { method: 'DELETE' })

  expect(result).toEqual({ ok: true, value: undefined })
})

test('apiFetch() still parses JSON on a normal 200 response', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ hello: 'world' }),
  }) as unknown as typeof fetch

  const result = await apiFetch<{ hello: string }>('/api/whatever')

  expect(result).toEqual({ ok: true, value: { hello: 'world' } })
})

test('apiFetchMultipart() POSTs the given FormData without a JSON Content-Type header', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ draft: { storeName: 'Carrefour' } }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const formData = new FormData()
  const result = await apiFetchMultipart<{ draft: { storeName: string } }>('/api/receipts/scan', formData)

  expect(result).toEqual({ ok: true, value: { draft: { storeName: 'Carrefour' } } })
  const [, init] = fetchMock.mock.calls[0]
  expect(init.method).toBe('POST')
  expect(init.body).toBe(formData)
  // Not literally `undefined` any more — the cookie/traceparent injection
  // always produces a headers object now — but the point of this test is
  // still true: no Content-Type, so `fetch` derives the multipart boundary
  // from the FormData itself instead of it being overwritten.
  expect(init.headers).not.toHaveProperty('Content-Type')
})

test('apiFetchMultipart() maps a non-ok response to Result.err', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 422,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'extraction_failed', message: 'oops' } }),
  }) as unknown as typeof fetch

  const result = await apiFetchMultipart('/api/receipts/scan', new FormData())

  expect(result).toEqual({ ok: false, error: { type: 'extraction_failed', message: 'oops' } })
})

test('an "unauthenticated" response flips the cached session to signed-out instead of leaving it stale', async () => {
  // A gate reading `useSessionQuery()` would otherwise still see the last
  // truthy session from cold start — this is the exact bug report: the
  // backend says unauthenticated, but nothing tells the app.
  queryClient.setQueryData(['session'], { userId: 'u1' })

  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 401,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'unauthenticated', message: 'Authentication required.' } }),
  }) as unknown as typeof fetch

  const result = await apiFetch('/api/products')

  expect(result.ok).toBe(false)
  expect(queryClient.getQueryData(['session'])).toBeNull()
})

test('another 401-shaped error (a rejected login, say) does not touch the cached session', async () => {
  queryClient.setQueryData(['session'], { userId: 'u1' })

  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 401,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'invalid_credentials', message: 'Email ou mot de passe invalide.' } }),
  }) as unknown as typeof fetch

  await apiFetch('/api/products')

  expect(queryClient.getQueryData(['session'])).toEqual({ userId: 'u1' })
})

test('apiFetch() records telemetry with the given action name when the response is not ok', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 422,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'validation_failed', message: 'oops' } }),
  }) as unknown as typeof fetch

  await apiFetch('/api/products', { method: 'POST' }, { action: 'fridge.create_product' })

  expect(spy).toHaveBeenCalledWith(
    'action failed: validation_failed',
    expect.objectContaining({ attributes: expect.objectContaining({ 'error.type': 'validation_failed', action: 'fridge.create_product', 'http.response.status_code': 422 }) }),
  )
  spy.mockRestore()
})

test('apiFetch() shows a toast and returns a network_error Result when fetch itself rejects', async () => {
  const onToast = jest.fn()
  const unsubscribe = subscribeToast(onToast)
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'))

  const result = await apiFetch('/api/products')

  expect(result).toEqual({ ok: false, error: { type: 'network_error', message: 'Impossible de contacter le serveur.' } })
  expect(onToast).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Impossible de contacter le serveur.', variant: 'error' }),
  )
  unsubscribe()
})

test('apiFetchMultipart() shows a toast and returns a network_error Result when fetch itself rejects', async () => {
  const onToast = jest.fn()
  const unsubscribe = subscribeToast(onToast)
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'))

  const result = await apiFetchMultipart('/api/receipts/scan', new FormData())

  expect(result).toEqual({ ok: false, error: { type: 'network_error', message: 'Impossible de contacter le serveur.' } })
  expect(onToast).toHaveBeenCalledTimes(1)
  unsubscribe()
})

test('a business error (4xx/5xx reached the server) does not also show a toast — only a genuine transport failure does', async () => {
  const onToast = jest.fn()
  const unsubscribe = subscribeToast(onToast)
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 422,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'validation_failed', message: 'oops' } }),
  }) as unknown as typeof fetch

  await apiFetch('/api/products', { method: 'POST' })

  expect(onToast).not.toHaveBeenCalled()
  unsubscribe()
})

test('apiFetch() falls back to method+path as the action label when none is given', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 500,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'server_error', message: 'oops' } }),
  }) as unknown as typeof fetch

  await apiFetch('/api/whatever')

  expect(spy).toHaveBeenCalledWith(
    'action failed: server_error',
    expect.objectContaining({ attributes: expect.objectContaining({ 'error.type': 'server_error', action: 'GET /api/whatever', 'http.response.status_code': 500 }) }),
  )
  spy.mockRestore()
})


test('transport failures emit once and malformed JSON keeps response correlation', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch
  await apiFetch('/api/products?token=secret')
  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy).toHaveBeenLastCalledWith('operation failed', expect.objectContaining({
    attributes: expect.objectContaining({ 'error.code': 'network_error', 'app.operation': 'GET /api/products' }),
  }))
  spy.mockClear()
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200,
    headers: new Headers({ 'x-request-id': 'request-123' }),
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  }) as unknown as typeof fetch
  await apiFetch('/api/products')
  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy).toHaveBeenLastCalledWith('invalid response', expect.objectContaining({
    attributes: expect.objectContaining({ 'error.code': 'invalid_response', request_id: 'request-123' }),
  }))
  spy.mockRestore()
})


test.each([apiFetch, (path: string) => apiFetchMultipart(path, new FormData())])('a transport failure preserves the session and credentials', async (request) => {
  jest.mocked(authClient.signOut).mockClear()
  queryClient.setQueryData(['session'], { userId: 'u1' })
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'))
  await request('/api/products')
  expect(queryClient.getQueryData(['session'])).toEqual({ userId: 'u1' })
  expect(authClient.signOut).not.toHaveBeenCalled()
})

test('an unauthenticated-shaped 503 is not confirmation of session revocation', async () => {
  jest.mocked(authClient.signOut).mockClear()
  queryClient.setQueryData(['session'], { userId: 'u1' })
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 503, ok: false,
    json: () => Promise.resolve({ error: { type: 'unauthenticated', message: 'Unavailable' } }),
  }) as unknown as typeof fetch
  await apiFetch('/api/products')
  expect(queryClient.getQueryData(['session'])).toEqual({ userId: 'u1' })
  expect(authClient.signOut).not.toHaveBeenCalled()
})
