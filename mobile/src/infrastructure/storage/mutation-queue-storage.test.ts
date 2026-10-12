import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { mutationQueueStorage } from './mutation-queue-storage.js'

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(), readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(), moveAsync: jest.fn(),
}))

const originalOS = Platform.OS
afterEach(() => { Platform.OS = originalOS; jest.resetAllMocks() })

test('native queue replacement writes the temporary file before moving it', async () => {
  Platform.OS = 'ios'
  jest.mocked(FileSystem.writeAsStringAsync).mockResolvedValue(undefined)
  jest.mocked(FileSystem.moveAsync).mockResolvedValue(undefined)
  await mutationQueueStorage.write([])
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///documents/household-mutation-queue-v1.json.tmp', '[]')
  expect(FileSystem.moveAsync).toHaveBeenCalledWith({ from: 'file:///documents/household-mutation-queue-v1.json.tmp', to: 'file:///documents/household-mutation-queue-v1.json' })
  expect(jest.mocked(FileSystem.writeAsStringAsync).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(FileSystem.moveAsync).mock.invocationCallOrder[0])
})

test('restart recovers a fully written temp file after an interrupted native replacement', async () => {
  Platform.OS = 'ios'
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: false, uri: '', isDirectory: false })
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: true, uri: '', isDirectory: false, size: 2, modificationTime: 0 })
  jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue('[]')
  expect(await mutationQueueStorage.read()).toEqual([])
  expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///documents/household-mutation-queue-v1.json.tmp')
})

test('corrupt storage is reported without overwriting the file', async () => {
  Platform.OS = 'android'
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true, uri: '', isDirectory: false, size: 2, modificationTime: 0 })
  jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue('{broken')
  await expect(mutationQueueStorage.read()).rejects.toThrow()
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled()
})

test('a storage failure propagates instead of confirming a durable write', async () => {
  Platform.OS = 'android'
  jest.mocked(FileSystem.writeAsStringAsync).mockRejectedValue(new Error('Full disk'))
  await expect(mutationQueueStorage.write([])).rejects.toThrow('Full disk')
  expect(FileSystem.moveAsync).not.toHaveBeenCalled()
})
