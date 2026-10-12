import AsyncStorage from '@react-native-async-storage/async-storage'
import type { OfflineCacheStorage } from '../../application/shared/offline-cache.js'

const KEY = 'garde-manger.offline-cache'

/** AsyncStorage owns the same key/value API on native and web. */
export function createOfflineCacheStorage(): OfflineCacheStorage {
  return {
    read: () => AsyncStorage.getItem(KEY),
    write: (value) => AsyncStorage.setItem(KEY, value),
    clear: () => AsyncStorage.removeItem(KEY),
  }
}
