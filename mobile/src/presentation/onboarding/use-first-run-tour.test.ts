import { act, renderHook, waitFor } from '@testing-library/react-native'
import { clearSetting, readSetting, writeSetting } from '../../application/shared/app-storage.js'
import { armFirstRunTour, useFirstRunTour } from './use-first-run-tour.js'

const mockFocus = jest.fn()
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    mockFocus.mockImplementation(callback)
    require('react').useEffect(callback, [callback])
  },
}))
jest.mock('../../application/shared/app-storage.js', () => ({
  readSetting: jest.fn(), writeSetting: jest.fn(), clearSetting: jest.fn(),
}))

const KEY = 'garde-manger.first-run-tour.armed'
let stored: string | null
beforeEach(() => {
  jest.clearAllMocks()
  stored = null
  jest.mocked(readSetting).mockImplementation(async () => stored)
  jest.mocked(writeSetting).mockImplementation(async (_key, value) => { stored = value })
  jest.mocked(clearSetting).mockImplementation(async () => { stored = null })
})

test('does not interrupt users who have not opted in', async () => {
  const { result } = await renderHook(() => useFirstRunTour(true))
  await waitFor(() => expect(readSetting).toHaveBeenCalledWith(KEY))
  expect(result.current.show).toBe(false)
})

test('waits for the household before showing the opted-in tour', async () => {
  await armFirstRunTour()
  const { result, rerender } = await renderHook(({ enabled }) => useFirstRunTour(enabled), { initialProps: { enabled: false } })
  expect(result.current.show).toBe(false)
  await rerender({ enabled: true })
  await waitFor(() => expect(result.current.show).toBe(true))
})

test('skipping or finishing stays dismissed on focus and remount', async () => {
  await armFirstRunTour()
  const { result, unmount } = await renderHook(() => useFirstRunTour(true))
  await waitFor(() => expect(result.current.show).toBe(true))
  await act(async () => { result.current.dismiss() })
  expect(result.current.show).toBe(false)
  expect(clearSetting).toHaveBeenCalledWith(KEY)
  await act(async () => { mockFocus() })
  expect(result.current.show).toBe(false)
  await unmount()
  const replay = await renderHook(() => useFirstRunTour(true))
  expect(replay.result.current.show).toBe(false)
})

test('an explicit replay is picked up when the mounted dashboard regains focus', async () => {
  const { result } = await renderHook(() => useFirstRunTour(true))
  expect(result.current.show).toBe(false)
  await armFirstRunTour()
  await act(async () => { mockFocus() })
  await waitFor(() => expect(result.current.show).toBe(true))
})

test('opting out clears a previously armed tour', async () => {
  await armFirstRunTour()
  await armFirstRunTour(false)
  const { result } = await renderHook(() => useFirstRunTour(true))
  expect(result.current.show).toBe(false)
  expect(stored).toBeNull()
})
