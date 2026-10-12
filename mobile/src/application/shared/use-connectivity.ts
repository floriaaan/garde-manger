import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { getTelemetry } from './telemetry.js'
import { useOfflineSimulation } from './connectivity-simulation.js'

/** Unknown stays unknown; a failed device-state read is not evidence of a lost connection. */
export function useConnectivity(includeSimulation = true): boolean | undefined {
  const [online, setOnline] = useState<boolean>()
  const simulatedOffline = useOfflineSimulation()
  useEffect(() => {
    let active = true
    let revision = 0
    function update(state: NetworkState) {
      // Drive queries from real device connectivity, never the visual debug override.
      // A connected LAN can reach a self-hosted server without public Internet.
      if (Platform.OS !== 'web' && typeof state.isConnected === 'boolean') {
        onlineManager.setOnline(state.isConnected)
      }
      if (state.isConnected === false || state.isInternetReachable === false) setOnline(false)
      else if (state.isConnected === true || state.isInternetReachable === true) setOnline(true)
    }
    async function refresh() {
      const request = ++revision
      try {
        const state = await getNetworkStateAsync()
        if (active && request === revision) update(state)
      } catch (error) {
        if (active) getTelemetry().recordError('network state read failed', { error })
      }
    }
    const network = addNetworkStateListener((state) => {
      revision++
      if (active) update(state)
    })
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh()
    })
    void refresh()
    return () => { active = false; network.remove(); foreground.remove() }
  }, [])
  // Transport consumers use the real state; debug simulation remains visual only.
  return includeSimulation && simulatedOffline ? false : online
}
