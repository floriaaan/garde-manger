import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptReviewScreen } from './receipt-review-screen.js'

// The job is picked up by the 2s poll, longer than `waitFor`'s default.
configure({ asyncUtilTimeout: 5000 })

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => true, setParams: jest.fn() },
  useFocusEffect: jest.fn(),
}))

// @testing-library/react-native v14: render() AND fireEvent (press/changeText/
// scroll) are async by default, both return a Promise — every call below must
// be awaited (cf. login-form.test.tsx's comment; this bit the mobile test
// harness once already).
function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('scans the image on mount and pre-fills the form from the draft', async () => {
  await renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-review-store-name').props.value).toBe('Carrefour'))
  expect(screen.getByText('Lait demi-écrémé')).toBeTruthy()
  expect(screen.getByTestId('receipt-review-photo').props.source).toEqual({ uri: 'file://receipt.jpg' })
})

test('pre-fills an item’s expiry from the AI’s estimate, counted from the receipt’s own date — and leaves it blank with none', async () => {
  await renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-item-0-toggle')).toBeTruthy())

  // Fixture: scannedAt 2026-08-28, "Lait demi-écrémé" carries expiresInDays: 10.
  await fireEvent.press(screen.getByTestId('receipt-item-0-toggle'))
  expect(screen.getByTestId('receipt-item-0-expires-at')).toHaveTextContent('7 septembre 2026')

  // "Pain de mie" carries no estimate (expiresInDays: null) — nothing guessed.
  await fireEvent.press(screen.getByTestId('receipt-item-1-toggle'))
  expect(screen.getByTestId('receipt-item-1-expires-at')).toHaveTextContent('Aucune date')
})

test('importing confirms what landed in the fridge instead of dropping the user on the dashboard', async () => {
  await renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-review-submit')).toBeTruthy())

  await act(async () => {
    await fireEvent.press(screen.getByTestId('receipt-review-submit'))
  })

  await waitFor(() => expect(screen.getByTestId('receipt-review-success')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('receipt-review-open-fridge'))
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/fridge')
})

test('rows are collapsed until opened, and a row can be dropped from the receipt', async () => {
  await renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-item-0-toggle')).toBeTruthy())
  expect(screen.queryByTestId('receipt-item-0-name')).toBeNull()

  await fireEvent.press(screen.getByTestId('receipt-item-0-toggle'))
  expect(screen.getByTestId('receipt-item-0-name').props.value).toBe('Lait demi-écrémé')

  await fireEvent.press(screen.getByTestId('receipt-item-0-remove'))

  await waitFor(() => expect(screen.queryByText('Lait demi-écrémé')).toBeNull())
})

test('an invalid line is named, opened and marked instead of failing with one string', async () => {
  await renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-item-0-toggle')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('receipt-item-0-toggle'))
  await fireEvent.changeText(screen.getByTestId('receipt-item-0-quantity'), 'deux')
  await fireEvent.press(screen.getByTestId('receipt-item-0-toggle'))

  await act(async () => {
    await fireEvent.press(screen.getByTestId('receipt-review-submit'))
  })

  await waitFor(() => expect(screen.getByTestId('receipt-item-0-quantity-error')).toBeTruthy())
  expect(screen.getByTestId('receipt-review-error')).toBeTruthy()
})

test('bulk location puts every item in the chosen place', async () => {
  await renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-review-all-freezer')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('receipt-review-all-freezer'))
  await fireEvent.press(screen.getByTestId('receipt-item-0-toggle'))

  expect(screen.getByTestId('receipt-item-0-location-freezer').props.accessibilityState.selected).toBe(true)
})

test('shows a retry hint when the scan fails', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  connector.enqueueReceiptScan = jest
    .fn()
    .mockResolvedValue({ ok: false, error: { type: 'extraction_failed', message: "L'extraction du ticket a échoué — réessayez avec une photo plus nette." } })

  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ReceiptReviewScreen imageUri="file://receipt.jpg" />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('receipt-scan-error-title')).toBeTruthy())
  // The backend's own message, not a generic client-side sentence — a
  // parse/provider/network failure each say something different.
  expect(screen.getByText("L'extraction du ticket a échoué — réessayez avec une photo plus nette.")).toBeTruthy()

  // Retry re-reads the same photo rather than sending the user back to the camera.
  await act(async () => {
    await fireEvent.press(screen.getByTestId('receipt-review-retry'))
  })

  expect(connector.enqueueReceiptScan).toHaveBeenCalledTimes(2)
  expect(router.replace).not.toHaveBeenCalled()
})

test('hides the retry button when no retry can fix the failure', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  // A missing AI-provider key is an admin fix, not a "try again" — retrying
  // would just fail the same way a second time.
  connector.enqueueReceiptScan = jest
    .fn()
    .mockResolvedValue({ ok: false, error: { type: 'provider_not_configured', message: 'Ce provider IA ne dispose pas des identifiants nécessaires.' } })

  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ReceiptReviewScreen imageUri="file://receipt.jpg" />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('receipt-scan-error-title')).toBeTruthy())
  expect(screen.getByText('Ce provider IA ne dispose pas des identifiants nécessaires.')).toBeTruthy()
  expect(screen.queryByTestId('receipt-review-retry')).toBeNull()
  expect(screen.getByTestId('receipt-review-retake')).toBeTruthy()
})
