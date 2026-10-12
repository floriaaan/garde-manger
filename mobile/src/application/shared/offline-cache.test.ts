import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { queryStaleTime } from './query-freshness.js'
import { startOfflineCache, type OfflineCacheStorage } from './offline-cache.js'
import { fakeSession } from '../../infrastructure/fake/fixtures/session.fixture.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { fakeProducts } from '../../infrastructure/fake/fixtures/product.fixture.js'
import { fakeShoppingItems } from '../../infrastructure/fake/fixtures/shopping-item.fixture.js'

const SERVER = 'https://example.com'
let value: string | null
let storage: OfflineCacheStorage
let clients: QueryClient[]
let stops: (() => void)[]

beforeEach(() => {
  jest.useFakeTimers()
  value = null
  clients = []
  stops = []
  storage = {
    read: jest.fn(async () => value),
    write: jest.fn(async (next) => { value = next }),
    clear: jest.fn(async () => { value = null }),
  }
})

afterEach(() => {
  stops.forEach((stop) => stop())
  clients.forEach((client) => client.clear())
  jest.useRealTimers()
})

async function boot(server = SERVER) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  const cache = await startOfflineCache(client, storage, server, jest.fn())
  stops.push(cache.stop)
  return { client, ...cache }
}

async function load(client: QueryClient) {
  client.setQueryData(['session'], fakeSession)
  client.setQueryData(['household'], fakeHousehold)
  client.setQueryData(['products', {}], fakeProducts, { updatedAt: 1234 })
  client.setQueryData(['product', fakeProducts[0].id], fakeProducts[0])
  client.setQueryData(['shopping-items'], fakeShoppingItems)
  await jest.advanceTimersByTimeAsync(1000)
}

test('cold start restores context, inventory and shopping before any network read', async () => {
  const first = await boot()
  await load(first.client)
  first.stop()
  const { client } = await boot()
  expect(client.getQueryData(['session'])).toEqual(fakeSession)
  expect(client.getQueryData(['household'])).toEqual(expect.objectContaining({ id: fakeHousehold.id }))
  expect(client.getQueryData(['products', {}])).toEqual(fakeProducts)
  expect(client.getQueryState(['products', {}])?.dataUpdatedAt).toBe(1234)
  expect(client.getQueryData(['product', fakeProducts[0].id])).toEqual(fakeProducts[0])
  expect(client.getQueryData(['shopping-items'])).toEqual(fakeShoppingItems)
  await expect(client.fetchQuery({ queryKey: ['products', {}], queryFn: async () => { throw new Error('offline') } })).rejects.toThrow('offline')
  expect(client.getQueryData(['products', {}])).toEqual(fakeProducts)
})

test('cold-start freshness uses persisted timestamps and a failed refresh survives another restart', async () => {
  const first = await boot()
  await load(first.client)
  const shoppingUpdatedAt = first.client.getQueryState(['shopping-items'])!.dataUpdatedAt
  first.stop()
  const next = await boot()
  let reject!: (error: Error) => void
  const readProducts = jest.fn(() => new Promise<typeof fakeProducts>((_resolve, fail) => { reject = fail }))
  const readShopping = jest.fn(async () => fakeShoppingItems)
  const products = new QueryObserver(next.client, {
    queryKey: ['products', {}], queryFn: readProducts, staleTime: queryStaleTime(['products']),
  })
  const shopping = new QueryObserver(next.client, {
    queryKey: ['shopping-items'], queryFn: readShopping, staleTime: queryStaleTime(['shopping-items']),
  })
  const unsubscribeProducts = products.subscribe(() => {})
  const unsubscribeShopping = shopping.subscribe(() => {})
  try {
    // The old inventory timestamp is stale; the just-written shopping list is fresh.
    expect(products.getCurrentResult().data).toEqual(fakeProducts)
    expect(products.getCurrentResult().isPending).toBe(false)
    expect(products.getCurrentResult().isFetching).toBe(true)
    expect(readProducts).toHaveBeenCalledTimes(1)
    expect(shopping.getCurrentResult().data).toEqual(fakeShoppingItems)
    expect(readShopping).not.toHaveBeenCalled()
    expect(next.client.getQueryState(['shopping-items'])!.dataUpdatedAt).toBe(shoppingUpdatedAt)
    reject(new Error('temporarily unavailable'))
    await jest.advanceTimersByTimeAsync(1000)
    expect(products.getCurrentResult().isRefetchError).toBe(true)
    expect(products.getCurrentResult().data).toEqual(fakeProducts)
    expect(next.client.getQueryState(['products', {}])!.dataUpdatedAt).toBe(1234)
    next.stop()
    const restored = await boot()
    expect(restored.client.getQueryData(['products', {}])).toEqual(fakeProducts)
    expect(restored.client.getQueryState(['products', {}])!.dataUpdatedAt).toBe(1234)
    expect(restored.client.getQueryState(['products', {}])!.status).toBe('success')
  } finally {
    unsubscribeProducts()
    unsubscribeShopping()
  }
})

test('allowlist excludes credentials, invites, integrations, settings, jobs and mutations', async () => {
  const { client } = await boot()
  await load(client)
  client.setQueryData(['session'], { ...fakeSession, token: 'secret-token' })
  for (const key of ['ai-settings', 'ha-link', 'linked-accounts', 'jobs', 'scan-drafts', 'receipts']) {
    client.setQueryData([key], { secret: 'never-persist' })
  }
  client.getMutationCache().build(client, { mutationKey: ['never-persist'] }, {
    context: undefined, data: undefined, error: null, failureCount: 0, failureReason: null,
    isPaused: true, status: 'pending', variables: { password: 'secret-password' }, submittedAt: Date.now(),
  })
  await jest.advanceTimersByTimeAsync(1000)
  expect(value).not.toContain('secret-token')
  expect(value).not.toContain(fakeHousehold.inviteCode)
  expect(value).not.toContain('never-persist')
  expect(value).not.toContain('secret-password')
  expect(JSON.parse(value!).cache.clientState.queries.map((query: { queryKey: string[] }) => query.queryKey[0]))
    .toEqual(['session', 'household', 'products', 'product', 'shopping-items'])
})

test.each(['server', 'account', 'household', 'version', 'corrupt'])('rejects a snapshot with mismatched %s', async (kind) => {
  const first = await boot()
  await load(first.client)
  first.stop()
  const snapshot = JSON.parse(value!)
  if (kind === 'account') snapshot.account = 'another-user'
  if (kind === 'household') snapshot.householdId = 'another-household'
  if (kind === 'version') snapshot.cache.buster = 'household-cache-v0'
  value = kind === 'corrupt' ? '{invalid' : JSON.stringify(snapshot)
  const { client } = await boot(kind === 'server' ? 'https://other.example.com' : SERVER)
  expect(client.getQueryData(['session'])).toBeUndefined()
  expect(client.getQueryData(['products', {}])).toBeUndefined()
  expect(value).toBeNull()
})

test.each(['sign-out', 'clear', 'household', 'account', 'server'])('%s cancels old reads and clears memory and disk', async (kind) => {
  const cache = await boot()
  await load(cache.client)
  let resolve!: (data: unknown) => void
  const request = cache.client.fetchQuery({ queryKey: ['products', {}], queryFn: () => new Promise((done) => { resolve = done }) }).catch(() => {})
  if (kind === 'sign-out') cache.client.setQueryData(['session'], null)
  if (kind === 'clear') cache.client.clear()
  if (kind === 'household') cache.client.setQueryData(['household'], null)
  if (kind === 'account') cache.client.setQueryData(['session'], { user: { ...fakeSession.user, id: 'other-user' } })
  if (kind === 'server') cache.changeServer('https://other.example.com')
  expect(cache.client.getQueryData(['products', {}])).toBeUndefined()
  resolve(fakeProducts)
  await request
  await jest.advanceTimersByTimeAsync(1000)
  expect(cache.client.getQueryData(['products', {}])).toBeUndefined()
  expect(value).toBeNull()
})

test('a new household and a new server persist only their own reads', async () => {
  const cache = await boot()
  await load(cache.client)
  cache.client.setQueryData(['household'], { ...fakeHousehold, id: 'other-household' })
  await jest.advanceTimersByTimeAsync(1000)
  expect(JSON.parse(value!).householdId).toBe('other-household')
  expect(JSON.parse(value!).cache.clientState.queries.map((query: { queryKey: string[] }) => query.queryKey[0])).toEqual(['session', 'household'])
  cache.changeServer('https://other.example.com')
  await load(cache.client)
  expect(JSON.parse(value!).cache.buster).toBe('household-cache-v2:https://other.example.com')
})

test('unavailable storage does not block boot or online reads', async () => {
  storage.read = async () => { throw new Error('unavailable') }
  storage.write = async () => { throw new Error('full') }
  storage.clear = async () => { throw new Error('unavailable') }
  const { client } = await boot()
  await expect(load(client)).resolves.toBeUndefined()
  expect(client.getQueryData(['products', {}])).toEqual(fakeProducts)
})

test.each(['sign-out', 'server', 'stop'])('a throttled write cannot recreate old data after %s', async (kind) => {
  const cache = await boot()
  await load(cache.client)
  // Leave another write in the persister's throttle window, without draining microtasks.
  cache.client.setQueryData(['shopping-items'], [])
  if (kind === 'sign-out') cache.client.setQueryData(['session'], null)
  if (kind === 'server') cache.changeServer('https://other.example.com')
  if (kind === 'stop') { cache.stop(); await storage.clear() }
  await jest.advanceTimersByTimeAsync(1000)
  expect(value).toBeNull()
})

test('a read that failed revalidation remains persistable without its error payload', async () => {
  const cache = await boot()
  await load(cache.client)
  await expect(cache.client.fetchQuery({
    queryKey: ['shopping-items'],
    queryFn: async () => { throw { message: 'offline', credential: 'secret-error-payload' } },
  })).rejects.toEqual(expect.objectContaining({ message: 'offline' }))
  await jest.advanceTimersByTimeAsync(1000)
  expect(value).not.toContain('secret-error-payload')
  cache.stop()
  const next = await boot()
  expect(next.client.getQueryData(['shopping-items'])).toEqual(fakeShoppingItems)
})

test('the previous custom snapshot schema is discarded', async () => {
  value = JSON.stringify({ version: 1, server: SERVER, session: fakeSession, household: fakeHousehold, queries: [] })
  const { client } = await boot()
  expect(client.getQueryData(['session'])).toBeUndefined()
  expect(value).toBeNull()
})


test.each(['sign-out', 'server', 'household'])('removal waits for an in-flight asynchronous write on %s', async (kind) => {
  const cache = await boot()
  await load(cache.client)
  let finishWrite!: () => void
  storage.write = jest.fn((next) => new Promise<void>((done) => {
    finishWrite = () => { value = next; done() }
  }))
  jest.mocked(storage.clear).mockClear()
  cache.client.setQueryData(['shopping-items'], [])
  await jest.advanceTimersByTimeAsync(0)
  expect(storage.write).toHaveBeenCalled()
  if (kind === 'sign-out') cache.client.setQueryData(['session'], null)
  if (kind === 'server') cache.changeServer('https://other.example.com')
  if (kind === 'household') cache.client.setQueryData(['household'], null)
  expect(storage.clear).not.toHaveBeenCalled()
  finishWrite()
  await jest.advanceTimersByTimeAsync(1000)
  expect(storage.clear).toHaveBeenCalled()
  expect(value).toBeNull()
})
