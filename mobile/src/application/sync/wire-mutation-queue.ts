import { focusManager, onlineManager } from '@tanstack/react-query'
import { queryClient } from '../shared/query-client.js'
import { showToast } from '../shared/toast.js'
import type { MutationQueue } from './mutation-queue.js'
import { getTelemetry } from '../shared/telemetry.js'

/** Replay on reconnect/foreground; the timer also retries temporary server failures. */
export function wireMutationQueue(queue: MutationQueue, restorePending: () => Promise<void>): () => void {
  let stopped = false
  let storageErrorShown = false
  let restoreErrorShown = false
  const restore = () => {
    void restorePending().then(() => { restoreErrorShown = false }, (error) => {
      if (!restoreErrorShown) getTelemetry().recordError('mutation queue restore failed', { error, attributes: {
        'app.operation': 'sync.restore', 'error.code': 'queue_restore_failed',
      } })
      restoreErrorShown = true
    })
  }
  const replay = (force = false) => {
    if (stopped || !onlineManager.isOnline() || !focusManager.isFocused()) return
    void queue.flush(force).then(() => { storageErrorShown = false }, (error) => {
      if (!storageErrorShown) {
        getTelemetry().recordError('mutation queue replay failed', { error, attributes: {
          'app.operation': 'sync.flush', 'error.code': 'queue_flush_failed',
        } })
        showToast('La file de synchronisation locale est indisponible. Vos données sont conservées.')
      }
      storageErrorShown = true
    })
  }
  const online = onlineManager.subscribe((value) => { if (value) replay(true) })
  const focus = focusManager.subscribe((value) => { if (value) replay(true) })
  const cache = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success' &&
      ['session', 'household'].includes(String(event.query.queryKey[0]))) {
      restore()
      replay()
    }
  })
  const timer = setInterval(() => replay(), 5_000)
  restore()
  replay()
  return () => {
    stopped = true
    clearInterval(timer)
    online()
    focus()
    cache()
  }
}
