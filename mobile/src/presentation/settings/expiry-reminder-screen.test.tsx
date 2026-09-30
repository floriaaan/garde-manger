import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ExpiryReminderScreen } from './expiry-reminder-screen.js'

jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}))

test('saves a household delay and shows the selected choice', async () => {
  const connector = new FakeFridgeConnector()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<ThemeProvider><QueryClientProvider client={queryClient}>
    <ConnectorProvider connector={connector}><ExpiryReminderScreen /></ConnectorProvider>
  </QueryClientProvider></ThemeProvider>)

  await waitFor(() => expect(screen.getByTestId('reminder-days-2').props.accessibilityState.selected).toBe(true))
  fireEvent.press(screen.getByTestId('reminder-days-7'))
  await waitFor(() => expect(screen.getByTestId('reminder-days-7').props.accessibilityState.selected).toBe(true))
  expect((await connector.getReminderSettings()).days).toBe(7)
  expect(screen.getByText(/Europe\/Paris/)).toBeTruthy()
})
