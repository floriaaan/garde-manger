import * as Notifications from 'expo-notifications'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { Result } from '../../domain/shared/result.js'
import { readSetting, writeSetting } from '../shared/app-storage.js'
import { disablePush, enablePush } from './push-notifications.js'

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone', expoConfig: { extra: { eas: { projectId: 'project-id' } } } },
}))
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExpoPushToken[test]' })),
}))
jest.mock('../shared/app-storage.js', () => ({ readSetting: jest.fn(), writeSetting: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(readSetting).mockImplementation(async (key) => key === 'push_token' ? 'ExpoPushToken[test]' : '1')
})

test('a rejected token removal preserves the local preference and can be retried', async () => {
  const connector = new FakeFridgeConnector()
  const unregister = jest.spyOn(connector, 'unregisterPushToken')
    .mockResolvedValueOnce(Result.err({ type: 'network_error', message: 'Offline' }))
  await expect(disablePush(connector)).rejects.toThrow('Unable to unregister push token')
  expect(writeSetting).not.toHaveBeenCalled()
  await disablePush(connector)
  expect(unregister).toHaveBeenCalledTimes(2)
  expect(writeSetting).toHaveBeenCalledWith('push_enabled', '0')
})

test('a transient token acquisition failure is recoverable rather than unsupported', async () => {
  jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValueOnce(new Error('Offline'))
  await expect(enablePush(new FakeFridgeConnector())).resolves.toBe('failed')
  expect(writeSetting).not.toHaveBeenCalled()
})

test('a failed server registration does not enable local reception', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'registerPushToken').mockResolvedValueOnce(Result.err({ type: 'network_error', message: 'Offline' }))
  await expect(enablePush(connector)).resolves.toBe('failed')
  expect(writeSetting).not.toHaveBeenCalled()
})
