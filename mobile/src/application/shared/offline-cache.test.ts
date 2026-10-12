import { QueryClient } from '@tanstack/react-query'
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
    write: jest.fn((next) => { value = next }),
    clear: jest.fn(() => { value = null }),
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

function load(client: QueryClient) {
  client.setQueryData(['session'], fakeSession)
  client.setQueryData(['household'], fakeHousehold)
  client.setQueryData(['products', {}], fakeProducts, { updatedAt: 1234 })
  client.setQueryData(['product', fakeProducts[0].id], fakeProducts[0])
  client.setQueryData(['shopping-items'], fakeShoppingItems)
  jest.advanceTimersByTime(100)
}

test('cold start restores context, inventory and shopping before any network read', async () => {
  const first = await boot()
  load(first.client)
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

test('allowlist excludes credentials, invites, integrations, settings, jobs and mutations', async () => {
  const { client } = await boot()
  load(client)
  client.setQueryData(['session'], { ...fakeSession, token: 'secret-token' })
  for (const key of ['ai-settings', 'ha-link', 'linked-accounts', 'jobs', 'scan-drafts', 'receipts']) {
    client.setQueryData([key], { secret: 'never-persist' })
  }
  jest.advanceTimersByTime(100)
  expect(value).not.toContain('secret-token')
  expect(value).not.toContain(fakeHousehold.inviteCode)
  expect(value).not.toContain('never-persist')
  expect(JSON.parse(value!).queries.map((query: { key: string[] }) => query.key[0]))
    .toEqual(['products', 'product', 'shopping-items'])
})

test.each(['server', 'account', 'household', 'version', 'corrupt'])('rejects a snapshot with mismatched %s', async (kind) => {
  const first = await boot()
  load(first.client)
  first.stop()
  const snapshot = JSON.parse(value!)
  if (kind === 'account') snapshot.account = 'another-user'
  if (kind === 'household') snapshot.householdId = 'another-household'
  if (kind === 'version') snapshot.version = 0
  value = kind === 'corrupt' ? '{invalid' : JSON.stringify(snapshot)
  const { client } = await boot(kind === 'server' ? 'https://other.example.com' : SERVER)
  expect(client.getQueryData(['session'])).toBeUndefined()
  expect(client.getQueryData(['products', {}])).toBeUndefined()
  expect(value).toBeNull()
})

test.each(['sign-out', 'clear', 'household', 'account', 'server'])('%s cancels old reads and clears memory and disk', async (kind) => {
  const cache = await boot()
  load(cache.client)
  let resolve!: (data: unknown) => void
  const request = cache.client.fetchQuery({ queryKey: ['products', {}], queryFn: () => new Promise((done) => { resolve = done }) }).catch(() => {})
  if (kind === 'sign-out') cache.client.setQueryData(['session'], null)
  if (kind === 'clear') cache.client.clear()
  if (kind === 'household') cache.client.setQueryData(['household'], null)
  if (kind === 'account') cache.client.setQueryData(['session'], { user: { ...fakeSession.user, id: 'other-user' } })
  if (kind === 'server') cache.changeServer('https://other.example.com')
  expect(value).toBeNull()
  resolve(fakeProducts)
  await request
  jest.advanceTimersByTime(100)
  expect(cache.client.getQueryData(['products', {}])).toBeUndefined()
  expect(value).toBeNull()
})

test('a new household and a new server persist only their own reads', async () => {
  const cache = await boot()
  load(cache.client)
  cache.client.setQueryData(['household'], { ...fakeHousehold, id: 'other-household' })
  jest.advanceTimersByTime(100)
  expect(JSON.parse(value!).householdId).toBe('other-household')
  expect(JSON.parse(value!).queries).toEqual([])
  cache.changeServer('https://other.example.com')
  load(cache.client)
  expect(JSON.parse(value!).server).toBe('https://other.example.com')
})

test('unavailable storage does not block boot or online reads', async () => {
  storage.read = async () => { throw new Error('unavailable') }
  storage.write = () => { throw new Error('full') }
  storage.clear = () => { throw new Error('unavailable') }
  const { client } = await boot()
  expect(() => load(client)).not.toThrow()
  expect(client.getQueryData(['products', {}])).toEqual(fakeProducts)
})
