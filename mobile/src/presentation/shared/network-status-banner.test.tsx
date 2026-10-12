import { act, render, screen } from '@testing-library/react-native'
import { useConnectivity } from '../../application/shared/use-connectivity.js'
import { ThemeProvider } from './theme-provider.js'
import { NetworkStatusBanner } from './network-status-banner.js'

jest.mock('../../application/shared/use-connectivity.js', () => ({ useConnectivity: jest.fn() }))

beforeEach(() => { jest.useFakeTimers(); jest.mocked(useConnectivity).mockReturnValue(undefined) })
afterEach(() => jest.useRealTimers())

test('unknown and initial online states are silent; offline persists and recovery dismisses', async () => {
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  jest.mocked(useConnectivity).mockReturnValue(false)
  await view.rerender(ui())
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  await act(() => { jest.advanceTimersByTime(10000) })
  expect(screen.getByTestId('network-status-banner')).toBeTruthy()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  expect(screen.getByRole('status')).toHaveTextContent('Connexion rétablie')
  await act(() => { jest.advanceTimersByTime(3500) })
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  await view.unmount()
})

test('an offline cold start alerts immediately; another outage cancels recovery dismissal', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
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
