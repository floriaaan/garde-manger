import { Platform } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'

/** Browser online/offline events are already handled by TanStack. */
export function wireOnlineManager(): () => void {
  if (Platform.OS === 'web') return () => {}
  let stopped = false
  let receivedEvent = false
  const update = (state: NetworkState) => {
    // Unknown reachability must not block a self-hosted server on a LAN.
    if (!stopped && typeof state.isConnected === 'boolean') {
      onlineManager.setOnline(state.isConnected)
    }
  }
  const subscription = addNetworkStateListener((state) => {
    receivedEvent = true
    update(state)
  })
  // A delayed initial read must not overwrite a newer connectivity event.
  void getNetworkStateAsync().then((state) => {
    if (!receivedEvent) update(state)
  }).catch(() => { /* Keep the last known state if native detection fails. */ })
  return () => {
    stopped = true
    subscription.remove()
  }
}
