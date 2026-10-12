import { useSyncExternalStore } from 'react'

// A session-only visual override: no persisted setting and no transport/authentication change.
let simulatedOffline = false
const listeners = new Set<() => void>()

export function setOfflineSimulation(enabled: boolean): void {
  if (simulatedOffline === enabled) return
  simulatedOffline = enabled
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useOfflineSimulation(): boolean {
  return useSyncExternalStore(subscribe, () => simulatedOffline, () => false)
}
