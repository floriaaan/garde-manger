import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeListScreen, isExpired, isExpiringSoon } from './fridge-list-screen.js'
import type { Product } from '../../domain/fridge/product.js'
import { fakeProductOutcomes } from '../../infrastructure/fake/fixtures/product-outcome.fixture.js'

// `AppShell` registers its scan action through expo-router's `useFocusEffect`,
// which needs a real navigation container. These screen tests render the shell
// without one, so the hook — and only the hook — is stubbed out.
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: jest.fn(),
}))

function calendarDayFromToday(offsetDays: number): string {
  const today = new Date()
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays)).toISOString()
}

function fakeProductExpiringIn(days: number | null): Product {
  return {
    id: 'p',
    name: 'Test',
    quantity: { amount: 1, unit: 'pièce' },
    location: 'fridge',
    // Midnight UTC of a calendar day — the shape every write in the app
    // produces (`new Date('2026-09-06').toISOString()`). Building an arbitrary
    // instant here instead read one day short between local and UTC midnight.
    expiresAt: days === null ? null : calendarDayFromToday(days),
    openedAt: null,
    category: 'Test',
    categories: null,
    openfoodfactId: null,
    receiptId: null,
    price: null,
    imageKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function renderWithProviders(children: ReactNode, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  ).then(() => connector)
}

test('renders the fixture products by name, on the shelf each one lives on', async () => {
  await renderWithProviders(<FridgeListScreen />)

  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  expect(screen.getByText('Épinards frais')).toBeTruthy()

  // The cupboard has no height in this renderer, so the virtualized list never
  // windows down to it — filtering is how the test reaches the last shelf, and
  // it is the same path a user takes.
  await fireEvent.press(screen.getByTestId('fridge-filter-pantry'))
  await waitFor(() => expect(screen.getByText('Riz basmati')).toBeTruthy())
})

test('filtering by "freezer" hides products in other locations', async () => {
  await renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-filter-freezer'))

  await waitFor(() => expect(screen.queryByText('Lait demi-écrémé')).toBeNull())
  await waitFor(() => expect(screen.getByText('Petits pois surgelés')).toBeTruthy())
})

test('isExpired is true only for products whose expiry date has already passed', () => {
  expect(isExpired(fakeProductExpiringIn(-1))).toBe(true)
  expect(isExpired(fakeProductExpiringIn(0))).toBe(false)
  expect(isExpired(fakeProductExpiringIn(1))).toBe(false)
  expect(isExpired(fakeProductExpiringIn(null))).toBe(false)
})

test('isExpiringSoon is true only within the window and never for already-expired products', () => {
  expect(isExpiringSoon(fakeProductExpiringIn(-1))).toBe(false)
  expect(isExpiringSoon(fakeProductExpiringIn(0))).toBe(true)
  expect(isExpiringSoon(fakeProductExpiringIn(3))).toBe(true)
  expect(isExpiringSoon(fakeProductExpiringIn(4))).toBe(false)
  expect(isExpiringSoon(fakeProductExpiringIn(null))).toBe(false)
})

test('a date already gone reads as passed, a date still ahead as something to cook', async () => {
  // The fixtures are relative to now, so no clock hack: the ham is two days
  // past and the milk is due tomorrow, whatever day this test runs.
  await renderWithProviders(<FridgeListScreen />)

  await waitFor(() => expect(screen.getByLabelText(/Jambon blanc.*Date dépassée de 2 j/)).toBeTruthy())
  expect(screen.getByLabelText(/Lait demi-écrémé.*À consommer demain/)).toBeTruthy()
})

test('groups products onto a shelf per compartment, and drops shelves that hold nothing', async () => {
  await renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  // One shelf header per compartment that actually holds something. The
  // fixture puts exactly one product in each of the three.
  expect(screen.getByText('FRIGO')).toBeTruthy()
  expect(screen.getByText('CONGÉLATEUR')).toBeTruthy()
  expect(screen.getByText('PLACARD')).toBeTruthy()

  // Filtering to one compartment leaves that shelf standing alone rather than
  // showing two empty labelled voids.
  await fireEvent.press(screen.getByTestId('fridge-filter-freezer'))

  await waitFor(() => expect(screen.getByText('CONGÉLATEUR')).toBeTruthy())
  expect(screen.queryByText('FRIGO')).toBeNull()
  expect(screen.queryByText('PLACARD')).toBeNull()
})

test('opened on the "dates dépassées" window, the cabinet holds only what a past date already lost', async () => {
  await renderWithProviders(<FridgeListScreen expiryWindow="expired" />)

  await waitFor(() => expect(screen.getByText('Jambon blanc')).toBeTruthy())
  expect(screen.queryByText('Petits pois surgelés')).toBeNull()
  expect(screen.queryByText('Riz basmati')).toBeNull()
})

test('opened on the "cette semaine" window, the cabinet holds what is still savable', async () => {
  await renderWithProviders(<FridgeListScreen expiryWindow="week" />)

  // Due inside the week, so it is still worth cooking…
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  // …while a date already gone, and a staple with no date at all, are not.
  expect(screen.queryByText('Jambon blanc')).toBeNull()
  expect(screen.queryByText('Riz basmati')).toBeNull()
})

test('the expiry windows sit in the same chip row as the compartments, and none is on by default', async () => {
  await renderWithProviders(<FridgeListScreen />)

  await waitFor(() => expect(screen.getByTestId('fridge-window-week')).toBeTruthy())

  expect(screen.getByTestId('fridge-window-week').props.accessibilityState.selected).toBe(false)
  expect(screen.getByTestId('fridge-window-expired').props.accessibilityState.selected).toBe(false)
  // Still the same row: the compartment chips are unchanged neighbours.
  expect(screen.getByTestId('fridge-filter-all')).toBeTruthy()
})

test('picking an expiry window asks for it; picking the selected one again asks for nothing', async () => {
  const onExpiryWindowChange = jest.fn()
  await renderWithProviders(<FridgeListScreen onExpiryWindowChange={onExpiryWindowChange} />)

  await waitFor(() => expect(screen.getByTestId('fridge-window-expired')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-window-expired'))

  expect(onExpiryWindowChange).toHaveBeenCalledWith('expired')
})

test('the chip is the way out of a window the dashboard opened', async () => {
  const onExpiryWindowChange = jest.fn()
  await renderWithProviders(
    <FridgeListScreen expiryWindow="expired" onExpiryWindowChange={onExpiryWindowChange} />,
  )

  await waitFor(() => expect(screen.getByTestId('fridge-window-expired')).toBeTruthy())
  expect(screen.getByTestId('fridge-window-expired').props.accessibilityState.selected).toBe(true)

  await fireEvent.press(screen.getByTestId('fridge-window-expired'))

  expect(onExpiryWindowChange).toHaveBeenCalledWith(null)
})

test('a fridge that could not be read says so, and never claims the shelves are empty', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getProducts').mockRejectedValue(new Error('network'))
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <FridgeListScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('fridge-retry')).toBeTruthy())

  // The lie this replaces: an unreachable server rendered the empty state,
  // telling a foyer its shared fridge held nothing.
  expect(screen.queryByText('Les étagères sont vides')).toBeNull()
  expect(screen.getByText('Garde-manger indisponible')).toBeTruthy()
})

test('a product announces its date, not just its name — the one thing the screen exists to say', async () => {
  await renderWithProviders(<FridgeListScreen />)

  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  // React Native collapses a Pressable's children into its own label, so
  // `accessibilityLabel={product.name}` made the quantity, the expiry and the
  // status badge inaudible — the screen minus its product.
  const row = screen.getByLabelText(/^Lait demi-écrémé, 1 L, /)

  expect(row).toBeTruthy()
})

test('a long press opens a selection, and several products leave in one confirmation', async () => {
  await renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  fireEvent(screen.getByTestId('fridge-product-fake-product-1'), 'longPress')

  await waitFor(() => expect(screen.getByText('1 produit sélectionné')).toBeTruthy())

  // A tap now selects rather than opens — the mode is the whole point.
  fireEvent.press(screen.getByTestId('fridge-product-fake-product-2'))
  await waitFor(() => expect(screen.getByText('2 produits sélectionnés')).toBeTruthy())

  fireEvent.press(screen.getByTestId('fridge-selection-remove'))

  // One sheet, naming the consequence once, for both products.
  await waitFor(() => expect(screen.getByText('Retirer 2 produits ?')).toBeTruthy())
})

test('several products thrown away at once: one reason for all, each logged whole', async () => {
  const connector = await renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Jambon blanc')).toBeTruthy())

  await fireEvent(screen.getByTestId('fridge-product-fake-product-6'), 'longPress')
  await fireEvent.press(screen.getByTestId('fridge-product-fake-product-4'))
  await fireEvent.press(screen.getByTestId('fridge-selection-remove'))

  await waitFor(() => expect(screen.getByTestId('product-exit-discarded')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('product-exit-discarded'))
  await waitFor(() => expect(screen.getByTestId('product-exit-reason-spoiled')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('product-exit-reason-spoiled'))
  await fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))

  await waitFor(() => expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length + 2))
  expect(connector.outcomes.slice(-2).map((o) => [o.productId, o.discardReason, o.quantity.amount])).toEqual([
    ['fake-product-6', 'spoiled', 4],
    ['fake-product-4', 'spoiled', 4],
  ])
  await waitFor(() => expect(screen.getByText(/^4 produits/)).toBeTruthy(), { timeout: 3000 })
})

test('several data-entry mistakes are deleted, not logged', async () => {
  const connector = await renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  await fireEvent(screen.getByTestId('fridge-product-fake-product-1'), 'longPress')
  await fireEvent.press(screen.getByTestId('fridge-selection-remove'))
  await waitFor(() => expect(screen.getByTestId('product-exit-correction')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('product-exit-correction'))
  await waitFor(() => expect(screen.queryByTestId('product-exit-correction')).toBeNull())

  // The connector, not the DOM: the virtualized list's own cell rendering
  // under the test renderer doesn't reliably reflect a data change on an
  // already-mounted row (the same quirk `--forceExit` works around), so the
  // connector is the reliable witness that a data-entry mistake deletes and
  // logs nothing.
  await waitFor(async () => expect(await connector.getProduct('fake-product-1')).toBeNull())
  expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length)
})

test('leaving the selection puts the list back to opening products', async () => {
  await renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  fireEvent(screen.getByTestId('fridge-product-fake-product-1'), 'longPress')
  await waitFor(() => expect(screen.getByTestId('fridge-selection-cancel')).toBeTruthy())

  fireEvent.press(screen.getByTestId('fridge-selection-cancel'))

  await waitFor(() => expect(screen.queryByTestId('fridge-selection-cancel')).toBeNull())
})
