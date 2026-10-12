import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { getTelemetry } from './telemetry.js'
import { useOfflineSimulation } from './connectivity-simulation.js'

/** Unknown stays unknown; a failed device-state read is not evidence of a lost connection. */
export function useConnectivity(): boolean | undefined {
  const [online, setOnline] = useState<boolean>()
  const simulatedOffline = useOfflineSimulation()
  useEffect(() => {
    let active = true
    let revision = 0
    function update(state: NetworkState) {
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
  return simulatedOffline ? false : online
}
