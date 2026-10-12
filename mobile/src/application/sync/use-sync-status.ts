import { useCallback, useSyncExternalStore } from 'react'
import { queryClient } from '../shared/query-client.js'
import { onServerUrlChange } from '../shared/server-config.js'
import type { MutationQueue } from './mutation-queue.js'

/** Queue writes and scope changes both refresh the status; no polling or requests. */
export function useSyncStatus(queue: MutationQueue | null) {
  const subscribe = useCallback((changed: () => void) => {
    const queueStop = queue?.subscribe(changed)
    const cacheStop = queryClient.getQueryCache().subscribe((event) => {
      if (['session', 'household'].includes(String(event.query.queryKey[0]))) changed()
    })
    const serverStop = onServerUrlChange(changed)
    return () => { queueStop?.(); cacheStop(); serverStop() }
  }, [queue])
  const snapshot = useCallback(() => queue?.getSnapshot() ?? '', [queue])
  useSyncExternalStore(subscribe, snapshot, snapshot)
  return queue?.status() ?? { entries: [], syncing: false, storageUnavailable: false }
}
