import { HttpFridgeConnector } from '../src/infrastructure/http/http-fridge-connector.js'
import { FakeFridgeConnector } from '../src/infrastructure/fake/fake-fridge-connector.js'
import { createFakeMutationQueue } from '../src/infrastructure/fake/fake-mutation-queue.js'
import type { Session } from '../src/domain/identity/session.js'
import type { Household } from '../src/domain/identity/household.js'
import { queryClient } from '../src/application/shared/query-client.js'
import type { FridgeConnector } from '../src/domain/interfaces/fridge-connector.js'
import { isFakeConnector } from '../src/application/shared/connector-mode.js'
import { withOfflineMutations } from '../src/application/sync/offline-connector.js'
import { wireMutationQueue } from '../src/application/sync/wire-mutation-queue.js'
import { mutationQueueStorage } from '../src/infrastructure/storage/mutation-queue-storage.js'
import { getTelemetry } from '../src/application/shared/telemetry.js'

const queues = new WeakMap<FridgeConnector, Pick<ReturnType<typeof withOfflineMutations>, 'queue' | 'restorePending'>>()

export function getConnectorMutationQueue(connector: FridgeConnector) {
  return queues.get(connector)?.queue ?? null
}

export function createConnector(): FridgeConnector {
  if (isFakeConnector) {
    const connector = new FakeFridgeConnector()
    const queue = createFakeMutationQueue('demo', () => {
      const session = queryClient.getQueryData<Session>(['session'])
      const household = queryClient.getQueryData<Household>(['household'])
      return session && household
        ? { server: 'demo', userId: session.user.id, householdId: household.id } : null
    })
    queues.set(connector, { queue, restorePending: async () => {} })
    return connector
  }
  const offline = withOfflineMutations(new HttpFridgeConnector(), mutationQueueStorage)
  const { connector } = offline
  queues.set(connector, offline)
  return connector
}

export function startConnectorSync(connector: FridgeConnector): () => void {
  if (isFakeConnector) return () => {}
  const offline = queues.get(connector)
  return offline ? wireMutationQueue(offline.queue, offline.restorePending) : () => {}
}

/** Restore pending overlays after the read cache, before query observers mount. */
export async function restoreConnectorMutations(connector: FridgeConnector): Promise<void> {
  try { await queues.get(connector)?.restorePending() }
  catch (error) { getTelemetry().recordError('mutation queue restore failed', { error }) }
}
