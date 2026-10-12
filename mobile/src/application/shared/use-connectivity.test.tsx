import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { useConnectivity } from './use-connectivity.js'
import { setOfflineSimulation } from './connectivity-simulation.js'

jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(), getNetworkStateAsync: jest.fn() }))
jest.mock('./telemetry.js', () => ({ getTelemetry: () => ({ recordError: jest.fn() }) }))

let onNetwork: (state: NetworkState) => void
let foreground: (state: AppStateStatus) => void
let remove: jest.Mock
beforeEach(() => {
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
afterEach(async () => { await act(() => setOfflineSimulation(false)); jest.restoreAllMocks() })

test('observes offline/recovery and ignores an older initial read after a network event', async () => {
  let resolve!: (state: NetworkState) => void
  jest.mocked(getNetworkStateAsync).mockReturnValue(new Promise((done) => { resolve = done }))
  const view = await renderHook(() => useConnectivity())
  expect(view.result.current).toBeUndefined()
  await act(() => onNetwork({ isConnected: false }))
  expect(view.result.current).toBe(false)
  await act(async () => { resolve({ isConnected: true }) })
  expect(view.result.current).toBe(false)
  await act(() => onNetwork({ isConnected: true, isInternetReachable: true }))
  expect(view.result.current).toBe(true)
  await act(() => onNetwork({ isConnected: true, isInternetReachable: false }))
  expect(view.result.current).toBe(false)
  await view.unmount()
  expect(remove).toHaveBeenCalled()
})

test('a failed state read stays unknown and foreground refresh restores detection', async () => {
  jest.mocked(getNetworkStateAsync).mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce({ isConnected: false })
  const view = await renderHook(() => useConnectivity())
  expect(view.result.current).toBeUndefined()
  await act(async () => { foreground('active') })
  expect(view.result.current).toBe(false)
  await view.unmount()
})

test('simulation overrides all observers and disabling it returns to the real network state', async () => {
  jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: true })
  const view = await renderHook(() => [useConnectivity(), useConnectivity()])
  expect(view.result.current).toEqual([true, true])
  await act(() => setOfflineSimulation(true))
  expect(view.result.current).toEqual([false, false])
  await act(() => setOfflineSimulation(false))
  expect(view.result.current).toEqual([true, true])
  await act(() => setOfflineSimulation(true))
  await act(() => onNetwork({ isConnected: false }))
  await act(() => setOfflineSimulation(false))
  expect(view.result.current).toEqual([false, false])
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
