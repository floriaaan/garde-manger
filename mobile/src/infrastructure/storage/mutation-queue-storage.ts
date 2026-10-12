import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import type { QueueStorage, QueuedMutation } from '../../application/sync/mutation-queue.js'

const KEY = 'household-mutation-queue-v1'

/** Queue writes must throw: reporting success after a failed write would lose user actions. */
export const mutationQueueStorage: QueueStorage = {
  async read() {
    let raw: string | null
    if (Platform.OS === 'web') raw = globalThis.localStorage.getItem(KEY)
    else {
      if (!FileSystem.documentDirectory) throw new Error('Durable storage unavailable')
      const path = `${FileSystem.documentDirectory}${KEY}.json`
      const exists = (await FileSystem.getInfoAsync(path)).exists
      // iOS's legacy move removes the destination before renaming. Recover the
      // fully written temporary file if the process stopped between those steps.
      if (!exists && !(await FileSystem.getInfoAsync(`${path}.tmp`)).exists) return []
      raw = await FileSystem.readAsStringAsync(exists ? path : `${path}.tmp`)
    }
    if (!raw) return []
    const entries: unknown = JSON.parse(raw)
    if (!Array.isArray(entries) || !entries.every((entry) =>
      typeof entry?.id === 'number' && typeof entry?.entityId === 'string' &&
      ['products', 'shopping-items'].includes(entry?.collection) &&
      typeof entry?.scope?.server === 'string' && typeof entry?.scope?.userId === 'string' &&
      typeof entry?.scope?.householdId === 'string' && entry?.base?.id === entry.entityId &&
      (entry.patch === null || (typeof entry.patch === 'object' && entry.patch !== null)) &&
      typeof entry?.attempts === 'number' && typeof entry?.retryAt === 'number',
    )) throw new Error('Invalid mutation queue; preserving existing data')
    return entries as QueuedMutation[]
  },
  async write(entries) {
    const raw = JSON.stringify(entries)
    if (Platform.OS === 'web') globalThis.localStorage.setItem(KEY, raw)
    else {
      if (!FileSystem.documentDirectory) throw new Error('Durable storage unavailable')
      const path = `${FileSystem.documentDirectory}${KEY}.json`
      await FileSystem.writeAsStringAsync(`${path}.tmp`, raw)
      await FileSystem.moveAsync({ from: `${path}.tmp`, to: path })
    }
  },
}
