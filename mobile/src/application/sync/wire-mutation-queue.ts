import * as Network from 'expo-network'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { queryClient } from '../shared/query-client.js'
import { showToast } from '../shared/toast.js'
import type { MutationQueue } from './mutation-queue.js'

/** Replay on reconnect/foreground; the timer also retries temporary server failures. */
export function wireMutationQueue(queue: MutationQueue, restorePending: () => Promise<void>): () => void {
  let stopped = false
  let storageErrorShown = false
  const replay = (force = false) => {
    if (stopped || !onlineManager.isOnline() || !focusManager.isFocused()) return
    void queue.flush(force).catch(() => {
      if (!storageErrorShown) showToast('La file de synchronisation locale est indisponible. Vos données sont conservées.')
      storageErrorShown = true
    })
  }
  const networkChanged = (state: Network.NetworkState) => {
    if (stopped) return
    // `null` means unknown, not disconnected.
    onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false)
  }
  const network = Network.addNetworkStateListener(networkChanged)
  void Network.getNetworkStateAsync().then(networkChanged).catch(() => {})
  const online = onlineManager.subscribe((value) => { if (value) replay(true) })
  const focus = focusManager.subscribe((value) => { if (value) replay(true) })
  const cache = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success' &&
      ['session', 'household'].includes(String(event.query.queryKey[0]))) {
      void restorePending().catch(() => {})
      replay()
    }
  })
  const timer = setInterval(() => replay(), 5_000)
  void restorePending().catch(() => {})
  replay()
  return () => {
    stopped = true
    clearInterval(timer)
    network.remove()
    online()
    focus()
    cache()
  }
}
