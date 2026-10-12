import { hashKey, type QueryClient, type QueryKey } from '@tanstack/react-query'
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Session } from '../../domain/identity/session.js'
import type { Household } from '../../domain/identity/household.js'

export interface OfflineCacheStorage {
  read(): Promise<string | null>
  write(value: string): void
  clear(): void
}

const VERSION = 2
const READS = new Set(['products', 'product', 'product-outcome-stats', 'shopping-items'])
const CONTEXT = new Set(['session', 'household'])
const PUBLIC = new Set(['instance-info', 'auth-methods'])
const isRead = (key: QueryKey) => typeof key[0] === 'string' && READS.has(key[0])

interface Snapshot {
  account: string
  householdId: string
  generation: number
  cache: PersistedClient
}

function context(cache: PersistedClient) {
  const queries = cache.clientState.queries
  const session = queries.find((query) => query.queryKey[0] === 'session')?.state.data as Session | undefined
  const household = queries.find((query) => query.queryKey[0] === 'household')?.state.data as Household | undefined
  if (typeof session?.user?.id !== 'string' || !session.user.id
    || typeof session.user.name !== 'string' || typeof session.user.email !== 'string'
    || !(session.user.image === null || typeof session.user.image === 'string')
    || typeof household?.id !== 'string' || !household.id || typeof household.name !== 'string'
    || !['owner', 'member'].includes(household.role) || !Array.isArray(household.members)
    || !household.members.every((member) => typeof member.userId === 'string'
      && typeof member.name === 'string' && typeof member.joinedAt === 'string'
      && ['owner', 'member'].includes(member.role))
    || !household.members.some((member) => member.userId === session.user.id)) return undefined
  return { session, household }
}

/** TanStack restores/subscribes; this boundary only owns isolation and sensitive-data policy. */
export async function startOfflineCache(
  client: QueryClient,
  storage: OfflineCacheStorage,
  server: string,
  reportError: (error: unknown) => void,
): Promise<{ changeServer(url: string): void; stop(): void }> {
  // Match infinite maxAge only for persisted reads; other caches retain their defaults.
  for (const root of [...CONTEXT, ...READS]) {
    client.setQueryDefaults([root], { ...client.getQueryDefaults([root]), gcTime: Infinity })
  }
  let generation = 0
  let changingContext = false
  function clearStorage() {
    try { storage.clear() } catch (error) { reportError(error) }
  }
  const asyncPersister = createAsyncStoragePersister({
    throttleTime: 100,
    storage: {
      getItem: () => storage.read(),
      // Throttled writes from a previous context must never recreate its snapshot.
      setItem: (_key, value) => { if (JSON.parse(value).generation === generation) storage.write(value) },
      removeItem: clearStorage,
    },
    retry: ({ error }) => { reportError(error); return undefined },
    serialize: (cache) => {
      const { session, household } = context(cache)!
      const { id, email, name, image } = session.user
      return JSON.stringify({
        account: id, householdId: household.id,
        generation: (cache as PersistedClient & { generation: number }).generation,
        cache: {
          ...cache,
          clientState: {
            mutations: [],
            queries: cache.clientState.queries.map((query) => ({
              queryKey: query.queryKey, queryHash: query.queryHash,
              state: {
                ...query.state, status: 'success', fetchStatus: 'idle',
                error: null, fetchFailureReason: null, fetchMeta: null,
                data: query.queryKey[0] === 'session' ? { user: { id, email, name, image } }
                  : query.queryKey[0] === 'household' ? {
                    id: household.id, name: household.name, role: household.role,
                    members: household.members.map(({ userId, name, image, role, joinedAt }) =>
                      ({ userId, name, image, role, joinedAt })),
                  } : query.state.data,
              },
            })),
          },
        },
      } satisfies Snapshot)
    },
    deserialize: (raw) => {
      const snapshot: Snapshot = JSON.parse(raw)
      const cache = snapshot.cache
      const scope = context(cache)
      if (!scope || snapshot.account !== scope.session.user.id || snapshot.householdId !== scope.household.id
        || cache.clientState.mutations.length !== 0
        || !cache.clientState.queries.every((query) => Array.isArray(query.queryKey)
          && query.queryHash === hashKey(query.queryKey)
          && (isRead(query.queryKey) || CONTEXT.has(String(query.queryKey[0])))
          && query.state.data !== undefined && Number.isFinite(query.state.dataUpdatedAt))) {
        throw new Error('Invalid offline cache context')
      }
      return cache
    },
  })
  const persister: Persister = {
    ...asyncPersister,
    persistClient: (cache) => !changingContext && context(cache)
      ? asyncPersister.persistClient(Object.assign(cache, { generation }))
      : undefined,
  }
  const options = () => ({
    queryClient: client, persister, buster: `household-cache-v${VERSION}:${server}`,
    dehydrateOptions: {
      shouldDehydrateMutation: () => false,
      shouldDehydrateQuery: (query: { queryKey: QueryKey; state: { data: unknown } }) =>
        query.state.data !== undefined && (isRead(query.queryKey) || CONTEXT.has(String(query.queryKey[0]))),
    },
  })
  try {
    // The root layout already gates mounting on this promise. No provider can fetch early.
    await persistQueryClientRestore({ ...options(), maxAge: Infinity })
  } catch (error) { reportError(error) }

  let account = client.getQueryData<Session>(['session'])?.user.id
  let householdId = client.getQueryData<Household>(['household'])?.id
  function discardReads(keepHousehold: boolean) {
    generation++
    changingContext = true
    client.removeQueries({ predicate: (query) => {
      const root = String(query.queryKey[0])
      return root !== 'session' && !PUBLIC.has(root) && !(keepHousehold && root === 'household')
    } })
    changingContext = false
    clearStorage()
  }
  // Register context invalidation before TanStack's save subscription.
  const unsubscribeContext = client.getQueryCache().subscribe((event) => {
    if (changingContext) return
    const root = String(event.query.queryKey[0])
    if (event.type === 'removed' && CONTEXT.has(root)) {
      if (root === 'session') account = undefined
      householdId = undefined
      discardReads(false)
    } else if (event.type === 'updated' && event.action.type === 'success') {
      if (root === 'session') {
        const next = client.getQueryData<Session>(['session'])?.user.id
        if (next !== account) { account = next; householdId = undefined; discardReads(false) }
      } else if (root === 'household') {
        const next = client.getQueryData<Household>(['household'])?.id
        if (next !== householdId) { householdId = next; discardReads(true) }
      }
    }
  })
  let unsubscribePersistence = persistQueryClientSubscribe(options())
  return {
    changeServer(url) {
      unsubscribePersistence()
      generation++
      server = url
      account = undefined
      householdId = undefined
      changingContext = true
      client.clear()
      changingContext = false
      clearStorage()
      unsubscribePersistence = persistQueryClientSubscribe(options())
    },
    stop() { generation++; unsubscribeContext(); unsubscribePersistence() },
  }
}
