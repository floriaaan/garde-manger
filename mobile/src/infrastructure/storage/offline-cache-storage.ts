import { Platform } from 'react-native'
import type { OfflineCacheStorage } from '../../application/shared/offline-cache.js'

const KEY = 'garde-manger.offline-cache'

/** Bulk read data belongs in a document file, not the credential keychain. */
export function createOfflineCacheStorage(): OfflineCacheStorage {
  if (Platform.OS === 'web') {
    return {
      read: async () => globalThis.localStorage?.getItem(KEY) ?? null,
      write: (value) => globalThis.localStorage?.setItem(KEY, value),
      clear: () => globalThis.localStorage?.removeItem(KEY),
    }
  }
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system')
  const file = new File(Paths.document, `${KEY}.json`)
  return {
    read: async () => file.exists ? file.text() : null,
    write: (value) => { if (!file.exists) file.create(); file.write(value) },
    clear: () => { if (file.exists) file.delete() },
  }
}
