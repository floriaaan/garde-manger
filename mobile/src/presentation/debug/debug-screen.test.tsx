import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { DebugScreen } from './debug-screen.js'
import { getLocaleOverride, i18n, setLocaleOverride } from '../../i18n/index.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

afterEach(() => setLocaleOverride(null))

test('switches rendered labels immediately and returns to the system locale', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(<ThemeProvider><QueryClientProvider client={client}>
    <ConnectorProvider connector={new FakeFridgeConnector()}><DebugScreen /></ConnectorProvider>
  </QueryClientProvider></ThemeProvider>)

  expect(screen.getByTestId('debug-locale-system').props.accessibilityState.selected).toBe(true)
  await fireEvent.press(screen.getByTestId('debug-locale-en'))
  await waitFor(() => expect(screen.getByText('Current server')).toBeTruthy())
  expect(screen.getByText('Scan a receipt')).toBeTruthy()
  expect(screen.getByTestId('debug-locale-en').props.accessibilityState.selected).toBe(true)
  expect(i18n.language).toBe('en')

  await fireEvent.press(screen.getByTestId('debug-locale-fr'))
  await waitFor(() => expect(screen.getByText('Serveur actuel')).toBeTruthy())
  expect(screen.getByText('Scanner un ticket')).toBeTruthy()
  expect(getLocaleOverride()).toBe('fr')

  await fireEvent.press(screen.getByTestId('debug-locale-system'))
  expect(getLocaleOverride()).toBeNull()
  expect(screen.getByTestId('debug-locale-system').props.accessibilityState.selected).toBe(true)
  client.clear()
})
