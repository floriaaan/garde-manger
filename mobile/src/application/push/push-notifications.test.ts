import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { Result } from '../../domain/shared/result.js'
import { readSetting, writeSetting } from '../shared/app-storage.js'
import { disablePush } from './push-notifications.js'

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
