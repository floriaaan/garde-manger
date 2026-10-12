import AsyncStorage from '@react-native-async-storage/async-storage'
import type { OfflineCacheStorage } from '../../application/shared/offline-cache.js'

/** AsyncStorage owns the same key/value API on native and web. */
export function createOfflineCacheStorage(key = 'garde-manger.offline-cache'): OfflineCacheStorage {
  return {
    read: () => AsyncStorage.getItem(key),
    write: (value) => AsyncStorage.setItem(key, value),
    clear: () => AsyncStorage.removeItem(key),
  }
}
