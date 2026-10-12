import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'
import { useConnectivity } from '../../application/shared/use-connectivity.js'
import { ThemeProvider } from './theme-provider.js'
import { NetworkStatusBanner } from './network-status-banner.js'
import { useReduceMotion } from './hover.js'

jest.mock('../../application/shared/use-connectivity.js', () => ({ useConnectivity: jest.fn() }))
jest.mock('./hover.js', () => ({ useReduceMotion: jest.fn() }))

Reanimated.setUpTests()

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(useConnectivity).mockReturnValue(undefined)
  jest.mocked(useReduceMotion).mockReturnValue(false)
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

async function measure(height = 110) {
  await fireEvent(screen.getByTestId('network-status-content'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
  })
}

test('unknown and initial online states are silent; offline persists and recovery dismisses', async () => {
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  jest.mocked(useConnectivity).mockReturnValue(false)
  await view.rerender(ui())
  await measure()
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  await act(() => { jest.advanceTimersByTime(10000) })
  expect(screen.getByTestId('network-status-banner')).toBeTruthy()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await measure(88)
  expect(screen.getByRole('status')).toHaveTextContent('Connexion rétablie')
  await act(() => { jest.advanceTimersByTime(3500) })
  expect(screen.getByTestId('network-status-banner')).toBeTruthy()
  await act(() => { jest.advanceTimersByTime(250) })
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  await view.unmount()
})

test('an offline cold start alerts immediately; another outage cancels recovery dismissal', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  await measure()
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await act(() => { jest.advanceTimersByTime(1000) })
  jest.mocked(useConnectivity).mockReturnValue(false)
  await view.rerender(ui())
  await act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  await view.unmount()
})

test('a new outage interrupts the closing animation without unmounting the alert', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  await measure()
  await act(() => { jest.advanceTimersByTime(300) })
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await measure(88)
  await act(() => { jest.advanceTimersByTime(3500) })
  await act(() => { jest.advanceTimersByTime(90) })
  jest.mocked(useConnectivity).mockReturnValue(false)
  await view.rerender(ui())
  await measure()
  await act(() => { jest.advanceTimersByTime(1000) })
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  await view.unmount()
})

test('Reduce Motion makes opening and closing immediate after measurement', async () => {
  jest.mocked(useReduceMotion).mockReturnValue(true)
  jest.mocked(useConnectivity).mockReturnValue(false)
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  await measure()
  // Shared styles commit on the next UI frame, with no timed interpolation.
  await act(() => { jest.advanceTimersByTime(17) })
  expect(screen.getByTestId('network-status-region')).toHaveAnimatedStyle({ height: 110 })
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await act(() => { jest.advanceTimersByTime(3500) })
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  await view.unmount()
})

test('height progresses between measured endpoints instead of jumping', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const view = await render(<ThemeProvider><NetworkStatusBanner /></ThemeProvider>)
  await measure()
  await act(() => { jest.advanceTimersByTime(120) })
  const { height } = Reanimated.getAnimatedStyle(screen.getByTestId('network-status-region'))
  expect(height).toBeGreaterThan(0)
  expect(height).toBeLessThan(110)
  await act(() => { jest.advanceTimersByTime(200) })
  expect(screen.getByTestId('network-status-region')).toHaveAnimatedStyle({ height: 110 })
  await view.unmount()
})
