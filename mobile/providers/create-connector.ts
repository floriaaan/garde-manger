import { HttpFridgeConnector } from '../src/infrastructure/http/http-fridge-connector.js'
import { FakeFridgeConnector } from '../src/infrastructure/fake/fake-fridge-connector.js'
import { createFakeMutationQueueStorage } from '../src/infrastructure/fake/fake-mutation-queue.js'
import { getServerUrl } from '../src/application/shared/server-config.js'
import type { FridgeConnector } from '../src/domain/interfaces/fridge-connector.js'
import { isFakeConnector } from '../src/application/shared/connector-mode.js'
import { withOfflineMutations } from '../src/application/sync/offline-connector.js'
import { wireMutationQueue } from '../src/application/sync/wire-mutation-queue.js'
import { mutationQueueStorage } from '../src/infrastructure/storage/mutation-queue-storage.js'
import { getTelemetry } from '../src/application/shared/telemetry.js'

const queues = new WeakMap<FridgeConnector, ReturnType<typeof withOfflineMutations>>()

export function getConnectorMutationQueue(connector: FridgeConnector) {
  return queues.get(connector)?.queue ?? null
}

export function createConnector(): FridgeConnector {
  const raw = isFakeConnector ? new FakeFridgeConnector() : new HttpFridgeConnector()
  const storage = isFakeConnector ? createFakeMutationQueueStorage(getServerUrl()) : mutationQueueStorage
  const offline = withOfflineMutations(raw, storage)
  const { connector } = offline
  queues.set(connector, offline)
  return connector
}

export function startConnectorSync(connector: FridgeConnector): () => void {
  const offline = queues.get(connector)
  return offline ? wireMutationQueue(offline.queue, offline.restorePending) : () => {}
}

/** Restore pending overlays after the read cache, before query observers mount. */
export async function restoreConnectorMutations(connector: FridgeConnector): Promise<void> {
  try { await queues.get(connector)?.restorePending() }
  catch (error) { getTelemetry().recordError('mutation queue restore failed', { error }) }
}
