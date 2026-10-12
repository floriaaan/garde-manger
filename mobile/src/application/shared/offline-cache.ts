import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { Session } from '../../domain/identity/session.js'
import type { Household } from '../../domain/identity/household.js'

export interface OfflineCacheStorage {
  read(): Promise<string | null>
  write(value: string): void
  clear(): void
}

const VERSION = 1
const READS = new Set(['products', 'product', 'product-outcome-stats', 'shopping-items'])
const CONTEXT = new Set(['session', 'household'])
const PUBLIC = new Set(['instance-info', 'auth-methods'])

function isRead(key: QueryKey): boolean {
  return typeof key[0] === 'string' && READS.has(key[0])
}

interface Snapshot {
  version: number
  server: string
  account: string
  householdId: string
  session: Session
  household: Household
  queries: { key: QueryKey; data: unknown; updatedAt: number }[]
}

/** Restore before mounting observers: no network request may race hydration. */
export async function startOfflineCache(
  client: QueryClient,
  storage: OfflineCacheStorage,
  server: string,
  reportError: (error: unknown) => void,
): Promise<{ changeServer(url: string): void; stop(): void }> {
  function safely(action: () => void) {
    try { action() } catch (error) { reportError(error) }
  }
  try {
    const raw = await storage.read()
    if (raw) {
      const snapshot: Snapshot = JSON.parse(raw)
      if (snapshot.version !== VERSION || snapshot.server !== server
        || typeof snapshot.account !== 'string' || !snapshot.account
        || snapshot.session?.user?.id !== snapshot.account
        || typeof snapshot.session.user.name !== 'string'
        || typeof snapshot.session.user.email !== 'string'
        || !(snapshot.session.user.image === null || typeof snapshot.session.user.image === 'string')
        || typeof snapshot.householdId !== 'string' || !snapshot.householdId
        || snapshot.household?.id !== snapshot.householdId
        || typeof snapshot.household.name !== 'string'
        || !['owner', 'member'].includes(snapshot.household.role)
        || !Array.isArray(snapshot.household.members)
        || !snapshot.household.members.every((member) => typeof member.userId === 'string'
          && typeof member.name === 'string' && typeof member.joinedAt === 'string'
          && ['owner', 'member'].includes(member.role))
        || !snapshot.household.members.some((member) => member.userId === snapshot.account)
        || !Array.isArray(snapshot.queries)
        || !snapshot.queries.every((query) => Array.isArray(query.key) && isRead(query.key)
          && query.data !== undefined && Number.isFinite(query.updatedAt) && query.updatedAt >= 0)) {
        safely(() => storage.clear())
      } else {
        client.setQueryData(['session'], snapshot.session)
        client.setQueryData(['household'], snapshot.household)
        for (const query of snapshot.queries) {
          client.setQueryData(query.key, query.data, { updatedAt: query.updatedAt })
        }
      }
    }
  } catch (error) {
    reportError(error)
    safely(() => storage.clear())
  }

  let account = client.getQueryData<Session>(['session'])?.user.id
  let householdId = client.getQueryData<Household>(['household'])?.id
  let changingContext = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function discardReads(keepHousehold: boolean) {
    changingContext = true
    // Removing queries cancels their in-flight reads before another context can use them.
    client.removeQueries({ predicate: (query) => {
      const root = String(query.queryKey[0])
      return root !== 'session' && !PUBLIC.has(root) && !(keepHousehold && root === 'household')
    } })
    changingContext = false
    safely(() => storage.clear())
  }

  function persist() {
    const session = client.getQueryData<Session>(['session'])
    const household = client.getQueryData<Household>(['household'])
    if (!session || !household || !household.members.some((member) => member.userId === session.user.id)) {
      safely(() => storage.clear())
      return
    }
    // Explicit projections: never serialize auth cookies/tokens or the owner's invite code.
    const { id, email, name, image } = session.user
    const snapshot: Snapshot = {
      version: VERSION, server, account: id, householdId: household.id,
      session: { user: { id, email, name, image } },
      household: {
        id: household.id, name: household.name, role: household.role,
        members: household.members.map(({ userId, name, image, role, joinedAt }) =>
          ({ userId, name, image, role, joinedAt })),
      },
      queries: client.getQueryCache().getAll()
        .filter((query) => isRead(query.queryKey) && query.state.data !== undefined)
        .map((query) => ({ key: query.queryKey, data: query.state.data, updatedAt: query.state.dataUpdatedAt })),
    }
    safely(() => storage.write(JSON.stringify(snapshot)))
  }

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (changingContext) return
    const root = String(event.query.queryKey[0])
    if (event.type === 'removed' && CONTEXT.has(root)) {
      if (timer) clearTimeout(timer)
      if (root === 'session') account = undefined
      householdId = undefined
      discardReads(false)
      return
    }
    if (event.type !== 'updated' || event.action.type !== 'success') return
    if (root === 'session') {
      const next = client.getQueryData<Session>(['session'])?.user.id
      if (next !== account) {
        account = next
        householdId = undefined
        discardReads(false)
      }
    } else if (root === 'household') {
      const next = client.getQueryData<Household>(['household'])?.id
      if (next !== householdId) {
        householdId = next
        discardReads(true)
      }
    }
    if (CONTEXT.has(root) || isRead(event.query.queryKey)) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(persist, 100)
    }
  })
  return {
    changeServer(url) {
      if (timer) clearTimeout(timer)
      server = url
      account = undefined
      householdId = undefined
      changingContext = true
      client.clear()
      changingContext = false
      safely(() => storage.clear())
    },
    stop() {
      unsubscribe()
      if (timer) clearTimeout(timer)
    },
  }
}
