import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptsListScreen } from './receipts-list-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
}))

function renderReceipts(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ReceiptsListScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('lists the receipts the foyer has imported', async () => {
  renderReceipts()

  await waitFor(() => expect(screen.getByText('Carrefour')).toBeTruthy())
})

test('an empty history offers the scanner instead of ending the walk', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getReceipts').mockResolvedValue([])

  renderReceipts(connector)

  await waitFor(() => expect(screen.getByTestId('receipts-empty-scan')).toBeTruthy())

  fireEvent.press(screen.getByTestId('receipts-empty-scan'))

  expect(router.push).toHaveBeenCalledWith('/scanner')
})

test('an unreadable history says so instead of reporting zero tickets', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getReceipts').mockRejectedValue(new Error('network'))

  renderReceipts(connector)

  await waitFor(() => expect(screen.getByTestId('receipts-retry')).toBeTruthy())

  expect(screen.queryByText(/Aucun ticket/)).toBeNull()
})
