import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeDetailScreen } from './fridge-detail-screen.js'
import { fakeProductOutcomes } from '../../infrastructure/fake/fixtures/product-outcome.fixture.js'

// expo-router's imperative `router` is a singleton wired up by the root
// <Slot>/<Stack> navigator. Nothing here mounts that navigator, so calling
// `router.back()` against the real module throws ("router store is not
// ready"). Stub it the same way the app's navigation itself is out of scope
// for this screen-level test — we only assert the delete-confirm flow.
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
 useFocusEffect: jest.fn(),
}))

async function renderWithProviders(children: ReactNode, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { connector, queryClient }
}

test('renders the product name, quantity, and category', async () => {
  await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)

  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  expect(screen.getByText('1 L')).toBeTruthy()
  expect(screen.getByText('Produits laitiers')).toBeTruthy()
})

test('finishing and restocking records the outcome after saving the chosen shopping total', async () => {
  const { connector } = await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)
  await waitFor(() => expect(screen.getByTestId('fridge-detail-consume')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('fridge-detail-consume'))
  await waitFor(() => expect(screen.getByTestId('restock-confirm').props.accessibilityState.disabled).toBe(false))
  await fireEvent.changeText(screen.getByTestId('restock-amount'), '3')
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(screen.getByTestId('fridge-detail-gone')).toHaveTextContent('Produit terminé et prévu'))
  expect(await connector.getProduct('fake-product-1')).toBeNull()
  expect(connector.outcomes.at(-1)).toMatchObject({ productId: 'fake-product-1', kind: 'consumed' })
  expect((await connector.getShoppingItems()).find((item) => item.id === 'fake-item-1')?.quantity.amount).toBe(3)
})

test('adding from the product fiche does not consume inventory', async () => {
  const { connector } = await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)
  await waitFor(() => expect(screen.getByTestId('fridge-detail-restock')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('fridge-detail-restock'))
  await waitFor(() => expect(screen.getByTestId('restock-keep').props.accessibilityState.disabled).toBe(false))
  await fireEvent.press(screen.getByTestId('restock-keep'))
  await waitFor(() => expect(screen.queryByTestId('restock-confirm')).toBeNull())
  expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length)
  expect(await connector.getProduct('fake-product-1')).not.toBeNull()
})

test('restocking consumes the opening snapshot when a member replenishes during confirmation', async () => {
  const { connector } = await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)
  await waitFor(() => expect(screen.getByTestId('fridge-detail-consume')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('fridge-detail-consume'))
  await waitFor(() => expect(screen.getByTestId('restock-confirm').props.accessibilityState.disabled).toBe(false))
  await connector.updateProduct('fake-product-1', { quantity: { amount: 6, unit: 'L' } })
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(screen.queryByTestId('restock-confirm')).toBeNull())
  expect((await connector.getProduct('fake-product-1'))?.quantity.amount).toBe(5)
  expect(connector.outcomes.at(-1)?.quantity.amount).toBe(1)
})

test('a committed consumption with a lost response can be retried without writing twice', async () => {
  const connector = new FakeFridgeConnector()
  const original = connector.recordProductOutcome.bind(connector)
  const outcome = jest.spyOn(connector, 'recordProductOutcome').mockImplementationOnce(async (...args) => {
    await original(...args)
    return { ok: false, error: { type: 'network_error', message: 'Réponse perdue' } }
  })
  const add = jest.spyOn(connector, 'createShoppingItem')
  await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />, connector)
  await waitFor(() => expect(screen.getByTestId('fridge-detail-consume')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('fridge-detail-consume'))
  await waitFor(() => expect(screen.getByTestId('restock-confirm').props.accessibilityState.disabled).toBe(false))
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(screen.getByTestId('restock-error')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(screen.getByTestId('fridge-detail-gone')).toBeTruthy())
  expect(outcome).toHaveBeenCalledTimes(2)
  expect(outcome.mock.calls[0][1]).toEqual(outcome.mock.calls[1][1])
  expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length + 1)
  expect(add).toHaveBeenCalledTimes(1)
})

test('finishing the last unit offers restocking and can finish without adding', async () => {
  const { connector } = await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-detail-consume'))
  await waitFor(() => expect(screen.getByTestId('restock-finish-only')).toBeTruthy())
  expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length)
  await fireEvent.press(screen.getByTestId('restock-finish-only'))

  await waitFor(() => expect(screen.getByTestId('fridge-detail-gone')).toBeTruthy())
  expect(screen.getByText('Produit terminé')).toBeTruthy()
  expect(connector.outcomes.at(-1)).toMatchObject({ kind: 'consumed', quantity: { amount: 1 } })
})

test('thrown away past its date: reason pre-picked, part of the stock, the rest stays', async () => {
  const { connector } = await renderWithProviders(<FridgeDetailScreen productId="fake-product-6" />)
  await waitFor(() => expect(screen.getByText('Jambon blanc')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-detail-remove'))
  await waitFor(() => expect(screen.getByTestId('product-exit-discarded')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('product-exit-discarded'))
  await waitFor(() => expect(screen.getByTestId('product-exit-amount-decrease')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('product-exit-amount-decrease'))
  await fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))

  await waitFor(() => expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length + 1))
  expect(connector.outcomes.at(-1)).toMatchObject({ kind: 'discarded', discardReason: 'expired', quantity: { amount: 3 } })
  expect(screen.queryByTestId('fridge-detail-gone')).toBeNull()
})

test('a data-entry mistake deletes without logging anything', async () => {
  const connector = new FakeFridgeConnector()
  const deleteSpy = jest.spyOn(connector, 'deleteProduct')
  await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />, connector)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-detail-remove'))
  await waitFor(() => expect(screen.getByTestId('product-exit-correction')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('product-exit-correction'))

  await waitFor(() => expect(screen.getByText('Produit supprimé')).toBeTruthy())
  expect(deleteSpy).toHaveBeenCalledWith('fake-product-1')
  expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length)
})

test('a failed exit shows an inline error, stays on screen, and invalidates nothing', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'recordProductOutcome').mockResolvedValue({
    ok: false,
    error: { type: 'product_not_found', message: 'Produit introuvable.' },
  })
  const { queryClient } = await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />, connector)
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  invalidateSpy.mockClear()

  await fireEvent.press(screen.getByTestId('fridge-detail-consume'))
  await waitFor(() => expect(screen.getByTestId('restock-finish-only')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('restock-finish-only'))

  await waitFor(() => expect(screen.getByTestId('fridge-detail-action-error')).toBeTruthy())
  expect(screen.queryByTestId('fridge-detail-gone')).toBeNull()
  expect(invalidateSpy).not.toHaveBeenCalled()
})
