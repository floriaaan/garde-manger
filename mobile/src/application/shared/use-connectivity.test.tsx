import { act, renderHook } from '@testing-library/react-native'
import { AppState, Platform, type AppStateStatus } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { useConnectivity } from './use-connectivity.js'
import { setOfflineSimulation } from './connectivity-simulation.js'

jest.mock('./connector-mode.js', () => ({ isFakeConnector: false }))
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(), getNetworkStateAsync: jest.fn() }))
jest.mock('./telemetry.js', () => ({ getTelemetry: () => ({ recordError: jest.fn() }) }))

let onNetwork: (state: NetworkState) => void
let foreground: (state: AppStateStatus) => void
let remove: jest.Mock
const originalOS = Platform.OS
beforeEach(() => {
  Platform.OS = 'ios'
  onlineManager.setOnline(true)
  setOfflineSimulation(false)
  jest.clearAllMocks()
  jest.mocked(getNetworkStateAsync).mockReset()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    foreground = callback
    return { remove: jest.fn() }
  })
  remove = jest.fn()
  const listeners = new Set<(state: NetworkState) => void>()
  onNetwork = (state) => listeners.forEach((listener) => listener(state))
  jest.mocked(addNetworkStateListener).mockImplementation((listener) => {
    listeners.add(listener)
    return { remove: () => { listeners.delete(listener); remove() } } as ReturnType<typeof addNetworkStateListener>
  })
})
afterEach(async () => {
  await act(() => setOfflineSimulation(false))
  onlineManager.setOnline(true)
  Platform.OS = originalOS
  jest.restoreAllMocks()
})

test('observes offline/recovery and ignores an older initial read after a network event', async () => {
  let resolve!: (state: NetworkState) => void
  jest.mocked(getNetworkStateAsync).mockReturnValue(new Promise((done) => { resolve = done }))
  const view = await renderHook(() => useConnectivity())
  expect(view.result.current).toBeUndefined()
  await act(() => onNetwork({ isConnected: false }))
  expect(view.result.current).toBe(false)
  expect(onlineManager.isOnline()).toBe(false)
  await act(async () => { resolve({ isConnected: true }) })
  expect(view.result.current).toBe(false)
  expect(onlineManager.isOnline()).toBe(false)
  await act(() => onNetwork({ isConnected: true, isInternetReachable: true }))
  expect(view.result.current).toBe(true)
  expect(onlineManager.isOnline()).toBe(true)
  await act(() => onNetwork({ isConnected: true, isInternetReachable: false }))
  expect(view.result.current).toBe(false)
  expect(onlineManager.isOnline()).toBe(true)
  await view.unmount()
  expect(remove).toHaveBeenCalled()
  await act(() => onNetwork({ isConnected: false }))
  expect(onlineManager.isOnline()).toBe(true)
})

test('a failed state read stays unknown and foreground refresh restores detection', async () => {
  jest.mocked(getNetworkStateAsync).mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce({ isConnected: false })
  const view = await renderHook(() => useConnectivity())
  expect(view.result.current).toBeUndefined()
  expect(onlineManager.isOnline()).toBe(true)
  await act(async () => { foreground('active') })
  expect(view.result.current).toBe(false)
  expect(onlineManager.isOnline()).toBe(false)
  await view.unmount()
})

test('simulation overrides all observers and disabling it returns to the real network state', async () => {
  jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: true })
  const view = await renderHook(() => [useConnectivity(), useConnectivity()])
  expect(view.result.current).toEqual([true, true])
  await act(() => setOfflineSimulation(true))
  expect(view.result.current).toEqual([false, false])
  expect(onlineManager.isOnline()).toBe(true)
  await act(() => setOfflineSimulation(false))
  expect(view.result.current).toEqual([true, true])
  await act(() => setOfflineSimulation(true))
  await act(() => onNetwork({ isConnected: false }))
  await act(() => setOfflineSimulation(false))
  expect(view.result.current).toEqual([false, false])
  expect(onlineManager.isOnline()).toBe(false)
  await view.unmount()
})

test('transport observers ignore visual simulation and still follow real connectivity', async () => {
  jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: true })
  const view = await renderHook(() => [useConnectivity(), useConnectivity(false)])
  await act(() => setOfflineSimulation(true))
  expect(view.result.current).toEqual([false, true])
  await act(() => onNetwork({ isConnected: false }))
  expect(view.result.current).toEqual([false, false])
  await view.unmount()
})

test.each(['ios', 'android'] as const)('%s shares connectivity transitions with queries and ignores unknown/repeated events', async (os) => {
  Platform.OS = os
  jest.mocked(getNetworkStateAsync).mockResolvedValue({})
  const changed = jest.fn()
  const unsubscribe = onlineManager.subscribe(changed)
  const view = await renderHook(() => useConnectivity())
  try {
    await act(() => onNetwork({ isConnected: false }))
    await act(() => onNetwork({ isConnected: false }))
    await act(() => onNetwork({}))
    expect(onlineManager.isOnline()).toBe(false)
    await act(() => onNetwork({ isConnected: true, isInternetReachable: false }))
    await act(() => onNetwork({ isConnected: true }))
    expect(changed.mock.calls).toEqual([[false], [true]])
  } finally {
    await view.unmount()
    unsubscribe()
  }
})

test('web retains browser connectivity handling for queries', async () => {
  Platform.OS = 'web'
  jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: false })
  const view = await renderHook(() => useConnectivity())
  expect(view.result.current).toBe(false)
  expect(onlineManager.isOnline()).toBe(true)
  await view.unmount()
})

test('a device-state read resolving after unmount does not change query connectivity', async () => {
  let resolve!: (state: NetworkState) => void
  jest.mocked(getNetworkStateAsync).mockReturnValue(new Promise((done) => { resolve = done }))
  const view = await renderHook(() => useConnectivity())
  await view.unmount()
  await act(async () => { resolve({ isConnected: false }) })
  expect(onlineManager.isOnline()).toBe(true)
})


test('fake transport keeps root-managed offline state when native network events arrive', async () => {
  const mode = jest.requireMock('./connector-mode.js') as { isFakeConnector: boolean }
  mode.isFakeConnector = true
  try {
    jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: true })
    const view = await renderHook(() => useConnectivity())
    await act(() => onlineManager.setOnline(false))
    await act(() => onNetwork({ isConnected: true }))
    expect(onlineManager.isOnline()).toBe(false)
    await view.unmount()
  } finally {
    mode.isFakeConnector = false
  }
})
