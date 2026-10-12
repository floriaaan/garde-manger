import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { useConnectivity } from './use-connectivity.js'

jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(), getNetworkStateAsync: jest.fn() }))
jest.mock('./telemetry.js', () => ({ getTelemetry: () => ({ recordError: jest.fn() }) }))

let onNetwork: (state: NetworkState) => void
let remove: jest.Mock
beforeEach(() => {
  jest.resetAllMocks()
  remove = jest.fn()
  jest.mocked(addNetworkStateListener).mockImplementation((listener) => {
    onNetwork = listener
    return { remove } as ReturnType<typeof addNetworkStateListener>
  })
})

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
  let foreground!: (state: AppStateStatus) => void
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    foreground = callback
    return { remove: jest.fn() }
  })
  jest.mocked(getNetworkStateAsync).mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce({ isConnected: false })
  const view = await renderHook(() => useConnectivity())
  expect(view.result.current).toBeUndefined()
  await act(async () => { foreground('active') })
  expect(view.result.current).toBe(false)
  await view.unmount()
  listener.mockRestore()
})
