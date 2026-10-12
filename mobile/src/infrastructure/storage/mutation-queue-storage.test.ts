import AsyncStorage from '@react-native-async-storage/async-storage'
import { mutationQueueStorage } from './mutation-queue-storage.js'

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}))

beforeEach(() => jest.resetAllMocks())

test('uses the local-first storage adapter with a separate mutation key', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('[]')
  expect(await mutationQueueStorage.read()).toEqual([])
  await mutationQueueStorage.write([])
  expect(AsyncStorage.getItem).toHaveBeenCalledWith('garde-manger.mutation-queue-v1')
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('garde-manger.mutation-queue-v1', '[]')
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled()
})

test('corrupt storage is reported without overwriting or removing queued actions', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('{broken')
  await expect(mutationQueueStorage.read()).rejects.toThrow()
  expect(AsyncStorage.setItem).not.toHaveBeenCalled()
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled()
})

test('a storage failure propagates instead of confirming a durable write', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('Full disk'))
  await expect(mutationQueueStorage.write([])).rejects.toThrow('Full disk')
})
