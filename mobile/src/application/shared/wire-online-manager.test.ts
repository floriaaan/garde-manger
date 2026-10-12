import { Platform } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { wireOnlineManager } from './wire-online-manager.js'

jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(),
  getNetworkStateAsync: jest.fn(),
}))

const originalOS = Platform.OS
let listener: (state: NetworkState) => void
let resolveInitial: (state: NetworkState) => void
const remove = jest.fn()

beforeEach(() => {
  onlineManager.setOnline(true)
  jest.mocked(addNetworkStateListener).mockImplementation((callback) => {
    listener = callback
    return { remove } as ReturnType<typeof addNetworkStateListener>
  })
  jest.mocked(getNetworkStateAsync).mockImplementation(() => new Promise((resolve) => { resolveInitial = resolve }))
})

afterEach(() => {
  Platform.OS = originalOS
  onlineManager.setOnline(true)
  jest.clearAllMocks()
})

test.each(['ios', 'android'] as const)('%s detects offline startup and emits only connectivity transitions', async (os) => {
  Platform.OS = os
  const changed = jest.fn()
  const unsubscribe = onlineManager.subscribe(changed)
  const stop = wireOnlineManager()
  try {
    resolveInitial({ isConnected: false })
    await Promise.resolve()
    expect(onlineManager.isOnline()).toBe(false)
    listener({ isConnected: false })
    listener({})
    // A LAN server can remain reachable without public Internet access.
    listener({ isConnected: true, isInternetReachable: false })
    listener({ isConnected: true })
    expect(changed.mock.calls).toEqual([[false], [true]])
    stop()
    expect(remove).toHaveBeenCalledTimes(1)
    listener({ isConnected: false })
    expect(onlineManager.isOnline()).toBe(true)
  } finally {
    stop()
    unsubscribe()
  }
})

test('a late initial read cannot overwrite a newer event or update after cleanup', async () => {
  Platform.OS = 'ios'
  const stop = wireOnlineManager()
  listener({ isConnected: false })
  resolveInitial({ isConnected: true })
  await Promise.resolve()
  expect(onlineManager.isOnline()).toBe(false)
  stop()
  const stopAgain = wireOnlineManager()
  stopAgain()
  resolveInitial({ isConnected: true })
  await Promise.resolve()
  expect(onlineManager.isOnline()).toBe(false)
})

test('a detection failure leaves the known state intact', async () => {
  Platform.OS = 'android'
  onlineManager.setOnline(false)
  jest.mocked(getNetworkStateAsync).mockRejectedValueOnce(new Error('native detection unavailable'))
  const stop = wireOnlineManager()
  await Promise.resolve()
  await Promise.resolve()
  expect(onlineManager.isOnline()).toBe(false)
  stop()
})

test('web keeps browser connectivity handling', () => {
  Platform.OS = 'web'
  wireOnlineManager()()
  expect(addNetworkStateListener).not.toHaveBeenCalled()
  expect(getNetworkStateAsync).not.toHaveBeenCalled()
})
