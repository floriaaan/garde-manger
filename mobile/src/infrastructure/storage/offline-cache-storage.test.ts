import AsyncStorage from '@react-native-async-storage/async-storage'
import { createOfflineCacheStorage } from './offline-cache-storage.js'

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}))

beforeEach(() => jest.resetAllMocks())

test('reads, writes and removes only the offline cache key through AsyncStorage', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('snapshot')
  const storage = createOfflineCacheStorage()
  expect(await storage.read()).toBe('snapshot')
  await storage.write('next')
  await storage.clear()
  expect(AsyncStorage.getItem).toHaveBeenCalledWith('garde-manger.offline-cache')
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('garde-manger.offline-cache', 'next')
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('garde-manger.offline-cache')
})

test('returns the write promise and propagates asynchronous failures to the persister', async () => {
  const error = new Error('storage full')
  jest.mocked(AsyncStorage.setItem).mockRejectedValue(error)
  await expect(createOfflineCacheStorage().write('snapshot')).rejects.toBe(error)
})
