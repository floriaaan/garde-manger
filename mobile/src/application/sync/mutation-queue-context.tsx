import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHouseholdQuery } from '../identity/household.query.js'
import { useSessionQuery } from '../identity/session.query.js'
import type { MutationQueue } from './mutation-queue.js'
import { useSyncStatus } from './use-sync-status.js'
import { Result } from '../../domain/shared/result.js'
import { getServerUrl } from '../shared/server-config.js'

const MutationQueueContext = createContext<MutationQueue | null>(null)

export function MutationQueueProvider({ queue, children }: { queue: MutationQueue | null; children: ReactNode }) {
  return <MutationQueueContext.Provider value={queue}>{children}</MutationQueueContext.Provider>
}

/** Local-only reads remain available offline; durable edits refresh the mounted list. */
export function useQueuedActions() {
  const queue = useContext(MutationQueueContext)
  const client = useQueryClient()
  const status = useSyncStatus(queue)
  const sessionQuery = useSessionQuery({ enabled: false })
  const session = sessionQuery.data
  const household = useHouseholdQuery({ enabled: false }).data
  const actions = useQuery({
    queryKey: ['sync-actions', getServerUrl(), session?.user.id, household?.id],
    queryFn: async () => {
      if (!queue) return []
      const [pending, failed] = await Promise.all([queue.pending(), queue.failures()])
      return [...pending, ...failed].sort((a, b) => a.id - b.id)
    },
    networkMode: 'always', retry: false,
  })
  useEffect(() => {
    if (!queue) return
    let entries = queue.getSnapshot().entries
    return queue.subscribe(() => {
      const next = queue.getSnapshot().entries
      if (next.length === entries.length && next.every((entry, index) => entry === entries[index])) return
      entries = next
      void client.invalidateQueries({ queryKey: ['sync-actions'] })
    })
  }, [queue, client])
  return { ...actions, scopeKey: JSON.stringify([getServerUrl(), session?.user.id, household?.id]), status,
    previewConflict: (id: number) => queue ? queue.previewConflict(id) : Promise.reject(new Error('sync.overwrite_unavailable')),
    overwrite: (id: number, reviewedUpdatedAt: string) => queue ? queue.overwrite(id, reviewedUpdatedAt) : Promise.resolve(),
    reconnect: async (id: number) => {
      const server = getServerUrl()
      const result = await sessionQuery.refetch()
      if (result.isError) throw new Error('sync.session_check_error')
      if (!result.data) return false
      if (result.data.user.id !== session?.user.id || getServerUrl() !== server ||
        client.getQueryData<{ id: string }>(['household'])?.id !== household?.id) throw new Error('sync.overwrite_unavailable')
      await queue?.retry(id)
      return true
    }, retry: (id: number) => queue ? queue.retry(id) : Promise.resolve(), cancel: (id: number) => queue ? queue.cancel(id)
    : Promise.resolve(Result.err({ type: 'action_unavailable', message: 'Cette action n’est plus disponible.' })) }
}
