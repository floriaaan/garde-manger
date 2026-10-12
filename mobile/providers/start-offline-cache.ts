import { startOfflineCache } from '../src/application/shared/offline-cache.js'
import { queryClient } from '../src/application/shared/query-client.js'
import { getServerUrl, onServerUrlChange } from '../src/application/shared/server-config.js'
import { getTelemetry } from '../src/application/shared/telemetry.js'
import { isFakeConnector } from '../src/application/shared/connector-mode.js'
import { createOfflineCacheStorage } from '../src/infrastructure/storage/offline-cache-storage.js'

export async function startAppOfflineCache(): Promise<() => void> {
  if (isFakeConnector) return () => {}
  let cache: Awaited<ReturnType<typeof startOfflineCache>>
  try {
    cache = await startOfflineCache(queryClient, createOfflineCacheStorage(), getServerUrl(),
      (error) => getTelemetry().recordError('offline cache storage failed', { error }))
  } catch (error) {
    getTelemetry().recordError('offline cache initialization failed', { error })
    return () => {}
  }
  // Server changes discard the previous snapshot before resetQueries revalidates.
  const unsubscribe = onServerUrlChange((url) => cache.changeServer(url))
  return () => { unsubscribe(); cache.stop() }
}
