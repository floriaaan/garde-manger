import { setLocaleOverride } from '../../i18n/index.js'
import { Platform } from 'react-native'
import { authClient } from '../auth/auth-client.js'
import { HttpFridgeConnector } from './http-fridge-connector.js'
import { queryClient } from '../../application/shared/query-client.js'
import { telemetry } from '../telemetry/telemetry.js'

jest.mock('../auth/auth-client.js', () => ({
  authClient: {
    signIn: {
      email: jest.fn(),
      social: jest.fn(),
      passkey: jest.fn(),
    },
    linkSocial: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
    passkey: { addPasskey: jest.fn() },
    signOut: jest.fn().mockResolvedValue(undefined),
    // Read by every apiFetch call (http-client.ts) to attach the session
    // cookie — unrelated to what most tests in this file exercise, but
    // still awaited on every request, so it needs a resolved value here.
    getCookie: jest.fn().mockResolvedValue(''),
    getSession: jest.fn(),
  },
}))

// `expo-file-system`'s real `File` implements `Blob` via a native binding
// that jest can't reproduce — its jest-environment stand-in isn't a real
// `Blob` instance, and Node's own `FormData.append(name, value, filename)`
// (the 3-arg form the receipt enqueue uses) strictly rejects anything that isn't
// one. Swapped for an actual `Blob` here so the test exercises
// `HttpFridgeConnector`'s own wiring rather than expo-file-system's.
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => new Blob(['fake-image-bytes'], { type: 'image/jpeg' })),
}))

const signInEmailMock = authClient.signIn.email as jest.Mock
const originalFetch = globalThis.fetch

afterEach(() => {
  setLocaleOverride(null)
  signInEmailMock.mockReset()
  jest.mocked(authClient.signOut).mockClear()
  queryClient.clear()
})

test('signInEmail() maps an authClient error to Result.err using error.code/message', async () => {
  signInEmailMock.mockResolvedValue({
    error: { code: 'invalid_credentials', message: 'Identifiants invalides.' },
  })

  const connector = new HttpFridgeConnector()
  const result = await connector.signInEmail('a@b.com', 'wrong-password')

  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error).toEqual({ type: 'invalid_credentials', message: 'Identifiants invalides.' })
  }
})

test('signInEmail() falls back to default type/message when error has no code/message', async () => {
  signInEmailMock.mockResolvedValue({ error: {} })

  const connector = new HttpFridgeConnector()
  const result = await connector.signInEmail('a@b.com', 'wrong-password')

  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error).toEqual({ type: 'sign_in_failed', message: 'Connexion impossible.' })
  }
})

test('signOut() swallows an authClient failure and reports it instead of throwing', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  ;(authClient.signOut as jest.Mock).mockRejectedValueOnce(new Error('network down'))

  const connector = new HttpFridgeConnector()
  await expect(connector.signOut()).resolves.toBeUndefined()

  expect(spy).toHaveBeenCalledWith(
    'identity.sign_out failed',
    expect.objectContaining({ attributes: { 'app.operation': 'identity.sign_out' } }),
  )
  spy.mockRestore()
})

test('getProducts() returns [] when the request fails', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 500,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'server_error', message: 'oops' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getProducts()).toEqual([])

  globalThis.fetch = originalFetch
})

test('getProducts() builds the query string from location/expiringWithinDays', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ products: [] }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  await connector.getProducts({ location: 'freezer', expiringWithinDays: 5 })

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/products?location=freezer&expiringWithinDays=5'),
    expect.anything(),
  )

  globalThis.fetch = originalFetch
})

test('deleteProduct() maps a 204 response to Result.ok(undefined)', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.deleteProduct('some-id')

  expect(result).toEqual({ ok: true, value: undefined })

  globalThis.fetch = originalFetch
})

test('recordProductOutcome() posts to the outcomes route and unwraps product and outcome', async () => {
  const outcome = {
    id: 'o-1',
    productId: 'p-1',
    recordedBy: 'u-1',
    recipeId: null,
    kind: 'discarded',
    discardReason: 'spoiled',
    productName: 'Yaourts',
    category: 'Laitier',
    categories: null,
    location: 'fridge',
    quantity: { amount: 2, unit: 'unités' },
    price: 1,
    expiresAt: null,
    occurredAt: '2026-09-13T18:00:00.000Z',
  }
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ product: null, outcome }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.recordProductOutcome('p-1', {
    kind: 'discarded',
    amount: 2,
    discardReason: 'spoiled',
  })

  expect(result).toEqual({ ok: true, value: { product: null, outcome } })
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toContain('/api/products/p-1/outcomes')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ kind: 'discarded', amount: 2, discardReason: 'spoiled' })

  globalThis.fetch = originalFetch
})

test('createShoppingItem() posts the JSON payload and unwraps the created item', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 201,
    ok: true,
    json: () =>
      Promise.resolve({
        item: { id: 'new-1', name: 'Farine', quantity: { amount: 1, unit: 'kg' }, checked: false, source: 'manual', createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.createShoppingItem({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.id).toBe('new-1')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/shopping-items')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })

  globalThis.fetch = originalFetch
})

test('updateShoppingItem() PATCHes the patch and returns Result.ok with the updated item', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () =>
      Promise.resolve({
        item: { id: 'fake-item-1', name: 'Lait demi-écrémé', quantity: { amount: 2, unit: 'L' }, checked: true, source: 'manual', createdAt: '2026-08-26T08:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.updateShoppingItem('fake-item-1', { checked: true })

  expect(result).toEqual({
    ok: true,
    value: { id: 'fake-item-1', name: 'Lait demi-écrémé', quantity: { amount: 2, unit: 'L' }, checked: true, source: 'manual', createdAt: '2026-08-26T08:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
  })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/shopping-items/fake-item-1')
  expect(init.method).toBe('PATCH')
  expect(JSON.parse(init.body)).toEqual({ checked: true })

  globalThis.fetch = originalFetch
})

test('deleteShoppingItem() maps a 204 response to Result.ok(undefined)', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.deleteShoppingItem('fake-item-1')

  expect(result).toEqual({ ok: true, value: undefined })

  globalThis.fetch = originalFetch
})

test('lookupProductByBarcode() returns null when the backend finds nothing', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ result: null }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.lookupProductByBarcode('0000000000000')).toBeNull()

  globalThis.fetch = originalFetch
})

test('lookupProductByBarcode() throws, rather than returning null, when the request fails', async () => {
  // A failed request and a genuine "nothing at this barcode" must not look
  // the same to the caller — the form shows a different message for each.
  globalThis.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  await expect(connector.lookupProductByBarcode('0000000000000')).rejects.toThrow(
    'Impossible de contacter le serveur.',
  )

  globalThis.fetch = originalFetch
})

const queuedJob = {
  id: 'job-1',
  kind: 'receipt_scan',
  status: 'queued',
  progress: { total: 1, done: 0, failed: [] },
  result: null,
  error: null,
  createdAt: '2026-08-28T10:00:00.000Z',
  startedAt: null,
  finishedAt: null,
}

test('enqueueReceiptScan() posts a multipart image and unwraps the queued job', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ status: 202, ok: true, json: () => Promise.resolve({ job: queuedJob }) })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.enqueueReceiptScan('file://receipt.jpg')

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.id).toBe('job-1')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/jobs/receipt-scan')
  expect(init.body).toBeInstanceOf(FormData)

  globalThis.fetch = originalFetch
})

test('enqueueReceiptScan() on web fetches the blob: URI and posts a real Blob part', async () => {
  // Regression test: web's real FormData/fetch don't understand RN's
  // native `{ uri, name, type }` shim at all — appending it threw
  // "Unsupported FormDataPart implementation" the moment the request body
  // was serialized, with the enqueue never reaching the network.
  const originalOS = Platform.OS
  Platform.OS = 'web'
  try {
    setLocaleOverride('en')
    const blob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' })
    const fetchMock = jest
      .fn()
      // First call: the connector's own `fetch(imageUri)` to read the blob: URI back out.
      .mockResolvedValueOnce({ blob: () => {
        setLocaleOverride('fr')
        return Promise.resolve(blob)
      } })
      // Second call: apiFetchMultipart's request to the backend.
      .mockResolvedValueOnce({ status: 202, ok: true, json: () => Promise.resolve({ job: queuedJob }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const connector = new HttpFridgeConnector()
    const result = await connector.enqueueReceiptScan('blob:http://localhost/fake-uri')

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('blob:http://localhost/fake-uri')
    const [url, init] = fetchMock.mock.calls[1] ?? []
    expect(url).toContain('/api/jobs/receipt-scan')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.body.get('language')).toBe('en')
  } finally {
    Platform.OS = originalOS
    globalThis.fetch = originalFetch
  }
})

test('enqueueReceiptScan() returns Result.err when the quota is spent', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 402,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'ai_quota_exceeded', message: 'Quota atteint.' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.enqueueReceiptScan('file://receipt.jpg')

  expect(result).toEqual({ ok: false, error: { type: 'ai_quota_exceeded', message: 'Quota atteint.' } })

  globalThis.fetch = originalFetch
})

test('importReceipt() posts the JSON payload and unwraps receipt + products', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 201,
    ok: true,
    json: () =>
      Promise.resolve({
        receipt: { id: 'r1', storeName: 'Carrefour', scannedAt: '2026-08-28T10:00:00.000Z', totalAmount: 24.5, imageKey: null, itemsCount: 1, createdAt: '2026-08-28T10:05:00.000Z' },
        products: [],
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.importReceipt({
    storeName: 'Carrefour',
    scannedAt: '2026-08-28T10:00:00.000Z',
    totalAmount: 24.5,
    items: [{ name: 'Lait', quantity: 1, unit: 'L', location: 'fridge' }],
  })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.receipt.id).toBe('r1')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/receipts/import')
  expect(init.method).toBe('POST')

  globalThis.fetch = originalFetch
})

test('getReceipts() returns [] when the request fails', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 500,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'server_error', message: 'oops' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getReceipts()).toEqual([])

  globalThis.fetch = originalFetch
})

test('getReceipt() returns null when the backend finds nothing', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 404,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'receipt_not_found', message: 'not found' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getReceipt('missing')).toBeNull()

  globalThis.fetch = originalFetch
})

test('getAiSettings() unwraps the settings object directly (no envelope key)', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ activeProvider: 'gemini', source: 'environment', availableProviders: ['gemini'] }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const settings = await connector.getAiSettings()

  expect(settings).toEqual({ activeProvider: 'gemini', source: 'environment', availableProviders: ['gemini'] })

  globalThis.fetch = originalFetch
})

test('setActiveAiProvider() PATCHes the provider and returns Result.ok with the updated settings', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ activeProvider: 'openai', source: 'database', availableProviders: ['gemini', 'openai'] }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.setActiveAiProvider('openai')

  expect(result).toEqual({ ok: true, value: { activeProvider: 'openai', source: 'database', availableProviders: ['gemini', 'openai'] } })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/settings/ai')
  expect(init.method).toBe('PATCH')
  expect(JSON.parse(init.body)).toEqual({ provider: 'openai' })

  globalThis.fetch = originalFetch
})


describe('authentication integrations', () => {
  const originalOS = Platform.OS
  const originalLocation = Object.getOwnPropertyDescriptor(window, 'location')

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
    if (originalLocation) Object.defineProperty(window, 'location', originalLocation)
    else Reflect.deleteProperty(window, 'location')
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  test.each(['web', 'ios'] as const)('OAuth uses the frontend origin on web and the native callback on %s', async (os) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
    Object.defineProperty(window, 'location', { configurable: true, value: { origin: 'https://app.example.com' } })
    const connector = new HttpFridgeConnector()
    jest.spyOn(connector, 'getSession').mockResolvedValue({ user: { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null } })
    ;(authClient.signIn.social as jest.Mock).mockResolvedValue({})
    ;(authClient.linkSocial as jest.Mock).mockResolvedValue({})
    const callbackURL = os === 'web' ? 'https://app.example.com/' : '/'
    await connector.signInSocial('google')
    await connector.linkSocial('pocketid')
    expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: 'google', callbackURL })
    expect(authClient.linkSocial).toHaveBeenCalledWith({ provider: 'pocketid', callbackURL })
  })

  test('web OAuth waits for the callback instead of checking for a session before redirect', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    Object.defineProperty(window, 'location', { configurable: true, value: { origin: 'https://app.example.com' } })
    ;(authClient.signIn.social as jest.Mock).mockResolvedValue({})
    const connector = new HttpFridgeConnector()
    const getSession = jest.spyOn(connector, 'getSession')

    expect(await connector.signInSocial('google')).toEqual({ ok: true, value: null })
    expect(getSession).not.toHaveBeenCalled()
  })

  test.each(['web', 'ios'] as const)('password recovery routes back to the requesting platform: %s', async (os) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
    Object.defineProperty(window, 'location', { configurable: true, value: { origin: 'https://app.example.com' } })
    ;(authClient.requestPasswordReset as jest.Mock).mockResolvedValue({})
    const result = await new HttpFridgeConnector().requestPasswordReset('alice@example.com')
    expect(result.ok).toBe(true)
    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
      email: 'alice@example.com',
      redirectTo: os === 'web' ? 'https://app.example.com/reset-password' : 'gardemanger://reset-password',
    })
  })

  test('an invalid reset token is surfaced as a failure, not success', async () => {
    ;(authClient.resetPassword as unknown as jest.Mock).mockResolvedValue({ error: { code: 'INVALID_TOKEN', message: 'Expired' } })
    expect(await new HttpFridgeConnector().resetPassword('expired', 'new-password')).toEqual({
      ok: false, error: { type: 'INVALID_TOKEN', message: 'Expired' },
    })
  })

  test('a successful Apple ceremony without a session is not treated as a login', async () => {
    const connector = new HttpFridgeConnector()
    ;(authClient.signIn.social as jest.Mock).mockResolvedValue({})
    jest.spyOn(connector, 'getSession').mockResolvedValue(null)
    expect((await connector.signInApple('identity-token')).ok).toBe(false)
  })

  test('passkey cancellation preserves its code for the UI', async () => {
    ;(authClient.signIn.passkey as jest.Mock).mockResolvedValue({ error: { code: 'ERROR_CEREMONY_ABORTED', message: 'Cancelled' } })
    expect(await new HttpFridgeConnector().signInPasskey()).toEqual({
      ok: false, error: { type: 'ERROR_CEREMONY_ABORTED', message: 'Cancelled' },
    })
  })
})

test('session retrieval propagates traceparent and keeps a structured auth failure code', async () => {
  const span = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceparent: `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`, end: jest.fn() }
  const start = jest.spyOn(telemetry, 'startClientSpan').mockReturnValue(span)
  const report = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  ;(authClient.getSession as jest.Mock).mockImplementationOnce(async ({ fetchOptions }) => {
    fetchOptions.onResponse({ response: { headers: new Headers({ 'x-request-id': 'session-request-123' }) } })
    return { error: { code: 'SERVICE_UNAVAILABLE', status: 503 } }
  })
  await expect(new HttpFridgeConnector().getSession()).rejects.toThrow('Impossible de vérifier la session')
  expect(authClient.getSession).toHaveBeenLastCalledWith(expect.objectContaining({ fetchOptions: expect.objectContaining({
    headers: { traceparent: span.traceparent }, signal: expect.any(AbortSignal),
  }) }))
  expect(report).toHaveBeenLastCalledWith('identity.get_session failed', expect.objectContaining({
    span, error: expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }),
    attributes: expect.objectContaining({ 'app.operation': 'identity.get_session', 'error.code': 'session_http_503', request_id: 'session-request-123' }),
  }))
  start.mockRestore()
  report.mockRestore()
})

test('session timeout has its own code and retains the aborted request as cause', async () => {
  jest.useFakeTimers()
  const report = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  ;(authClient.getSession as jest.Mock).mockImplementationOnce(({ fetchOptions }) => new Promise((resolve) => {
    fetchOptions.signal.addEventListener('abort', () => resolve({ error: { name: 'AbortError' } }))
  }))
  const request = expect(new HttpFridgeConnector().getSession()).rejects.toThrow('Impossible de vérifier la session')
  await jest.advanceTimersByTimeAsync(5000)
  await request
  expect(authClient.signOut).not.toHaveBeenCalled()
  expect(report).toHaveBeenLastCalledWith('identity.get_session failed', expect.objectContaining({
    error: expect.objectContaining({ code: 'session_timeout', cause: { name: 'AbortError' } }),
  }))
  report.mockRestore()
  jest.useRealTimers()
})


describe('session lifecycle on native platforms', () => {
  const originalOS = Platform.OS
  const data = { user: { id: 'u1', email: 'alice@example.com', name: 'Alice' } }

  afterEach(() => {
    Platform.OS = originalOS
  })

  test.each(['ios', 'android'] as const)('%s keeps credentials on repeated checks and after a connector restart', async (os) => {
    Platform.OS = os
    ;(authClient.getSession as jest.Mock).mockResolvedValue({ data })
    const connector = new HttpFridgeConnector()
    for (let i = 0; i < 3; i++) {
      expect(await connector.getSession()).toEqual({ user: { ...data.user, image: null } })
    }
    expect(await new HttpFridgeConnector().getSession()).toEqual({ user: { ...data.user, image: null } })
    expect(authClient.signOut).not.toHaveBeenCalled()
  })

  test.each(['ios', 'android'] as const)('%s preserves credentials on a transport error and can recover', async (os) => {
    Platform.OS = os
    ;(authClient.getSession as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce({ data })
    const connector = new HttpFridgeConnector()
    await expect(connector.getSession()).rejects.toThrow('Impossible de vérifier la session')
    expect(authClient.signOut).not.toHaveBeenCalled()
    expect(await connector.getSession()).toEqual({ user: { ...data.user, image: null } })
  })

  test.each([403, 429, 500, 503])('HTTP %s remains a retryable session read', async (status) => {
    ;(authClient.getSession as jest.Mock).mockResolvedValueOnce({ error: { status } })
    await expect(new HttpFridgeConnector().getSession()).rejects.toThrow()
    expect(authClient.signOut).not.toHaveBeenCalled()
  })

  test.each([{ data: null }, { error: { status: 401, code: 'UNAUTHORIZED' } }])('confirmed absence/refusal clears credentials: %j', async (response) => {
    ;(authClient.getSession as jest.Mock).mockResolvedValueOnce(response)
    expect(await new HttpFridgeConnector().getSession()).toBeNull()
    expect(authClient.signOut).toHaveBeenCalledTimes(1)
  })

  test.each([{}, { data: { user: {} } }])('a malformed successful response does not clear credentials: %j', async (response) => {
    ;(authClient.getSession as jest.Mock).mockResolvedValueOnce(response)
    await expect(new HttpFridgeConnector().getSession()).rejects.toThrow()
    expect(authClient.signOut).not.toHaveBeenCalled()
  })

  test('explicit offline sign-out clears cached account data and session', async () => {
    queryClient.setQueryData(['session'], data)
    queryClient.setQueryData(['shopping-items'], [{ id: 'private-item' }])
    ;(authClient.signOut as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'))
    await new HttpFridgeConnector().signOut()
    expect(queryClient.getQueryData(['session'])).toBeNull()
    expect(queryClient.getQueryData(['shopping-items'])).toBeUndefined()
  })
})

test('AI job payloads capture the selected locale after live switches', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 202, ok: true, json: () => Promise.resolve({ job: queuedJob }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  try {
    const connector = new HttpFridgeConnector()
    for (const language of ['en', 'fr'] as const) {
      setLocaleOverride(language)
      await connector.enqueueRecipeGeneration('Avec du lait')
      expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({
        prompt: 'Avec du lait', language,
      })
      await connector.enqueueRecipeGeneration()
      expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({ language })
      await connector.enqueueReceiptScan('file://receipt.pdf')
      expect(fetchMock.mock.calls.at(-1)![1].body.get('language')).toBe(language)
      await connector.enqueueFridgeScan(['file://fridge.jpg'])
      expect(fetchMock.mock.calls.at(-1)![1].body.get('language')).toBe(language)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})
