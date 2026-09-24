import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeProducts } from '../../infrastructure/fake/fixtures/product.fixture.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeFormScreen } from './fridge-form-screen.js'

/** Drives `DateField`'s picker the way a member does: open it, pick a day. */
async function pickDate(testID: string, isoDay: string) {
  await fireEvent.press(screen.getByTestId(testID))
  await fireEvent(screen.getByTestId(`${testID}-picker`), 'change', { type: 'set' }, new Date(`${isoDay}T00:00:00`))
}

// `AppShell` registers its scan action through expo-router's `useFocusEffect`,
// which needs a real navigation container. These screen tests render the shell
// without one, so the hook — and only the hook — is stubbed out.
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: jest.fn(),
}))

function renderWithProviders(children: ReactNode, connector: FakeFridgeConnector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('submitting a valid create form calls onSuccess', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<FridgeFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('fridge-form-name'), 'Beurre doux')
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'plaquette')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})

test('an invalid quantity shows an inline error and does not submit', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<FridgeFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('fridge-form-name'), 'Beurre doux')
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '0')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'plaquette')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() =>
    expect(screen.getByText('La quantité doit être un entier supérieur à 0.')).toBeTruthy(),
  )
  expect(onSuccess).not.toHaveBeenCalled()
})

test('edit mode pre-fills the form from the existing product', async () => {
  await renderWithProviders(<FridgeFormScreen mode="edit" productId="fake-product-1" onSuccess={jest.fn()} />)

  await waitFor(() => expect(screen.getByTestId('fridge-form-name').props.value).toBe('Lait demi-écrémé'))
  expect(screen.getByTestId('fridge-form-amount').props.value).toBe('1')
  expect(screen.getByTestId('fridge-form-unit').props.value).toBe('L')
  // The fixture dates are relative to today, so the expectation is too: the
  // milk is due tomorrow, shown as a readable date rather than `YYYY-MM-DD`.
  const tomorrow = fakeProducts.find((product) => product.id === 'fake-product-1')?.expiresAt?.slice(0, 10) ?? ''
  const readable = new Date(`${tomorrow}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  expect(screen.getByTestId('fridge-form-expires-at')).toHaveTextContent(readable)
})

test('submitting with an expiresAt value round-trips it into the create payload as an ISO string', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  const createSpy = jest.spyOn(connector, 'createProduct')
  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <FridgeFormScreen mode="create" onSuccess={jest.fn()} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await fireEvent.changeText(screen.getByTestId('fridge-form-name'), 'Yaourt nature')
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '4')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'pots')
  await pickDate('fridge-form-expires-at', '2026-09-10')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
  expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ expiresAt: new Date('2026-09-10').toISOString() })
})

test('submitting an edit form with an updated expiresAt round-trips it into the update payload', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  const updateSpy = jest.spyOn(connector, 'updateProduct')
  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <FridgeFormScreen mode="edit" productId="fake-product-1" onSuccess={jest.fn()} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('fridge-form-name').props.value).toBe('Lait demi-écrémé'))
  await pickDate('fridge-form-expires-at', '2026-09-20')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1))
  expect(updateSpy.mock.calls[0]?.[1]).toMatchObject({ expiresAt: new Date('2026-09-20').toISOString() })
})

test('submitting with an empty expiresAt sends null', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  const createSpy = jest.spyOn(connector, 'createProduct')
  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <FridgeFormScreen mode="create" onSuccess={jest.fn()} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await fireEvent.changeText(screen.getByTestId('fridge-form-name'), 'Beurre doux')
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'plaquette')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
  expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ expiresAt: null })
})

test('a prefillBarcode found in the lookup fixture pre-fills the name, and the category it carries reaches the create payload with no field for it in the UI', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  const createSpy = jest.spyOn(connector, 'createProduct')
  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <FridgeFormScreen mode="create" prefillBarcode="3017620422003" onSuccess={jest.fn()} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() =>
    expect(screen.getByTestId('fridge-form-name').props.value).toBe('Pâte à tartiner noisettes-cacao'),
  )
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'pot')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
  expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ category: 'Pâtes à tartiner' })
})

test('scanning a barcode from an edit form applies the lookup result, not the original product data, regardless of which query settles first', async () => {
  // Regression test for the edit-prefill vs. barcode-lookup-prefill race: both effects
  // write name/category (category has no field of its own — see the payload-level
  // coverage above — but shares the same race-prone effects as name, so the name
  // assertion below still exercises it), and a deliberate scan should always win
  // over the product's original data even though `existing` (fake-product-1) and
  // `lookup` can settle in either order.
  await renderWithProviders(
    <FridgeFormScreen mode="edit" productId="fake-product-1" prefillBarcode="3017620422003" onSuccess={jest.fn()} />,
  )

  await waitFor(() =>
    expect(screen.getByTestId('fridge-form-name').props.value).toBe('Pâte à tartiner noisettes-cacao'),
  )
  expect(screen.getByTestId('fridge-form-name').props.value).not.toBe('Lait demi-écrémé')
})

test('a prefillBarcode not in the lookup fixture shows an informational hint, leaves the form empty', async () => {
  await renderWithProviders(<FridgeFormScreen mode="create" prefillBarcode="0000000000000" onSuccess={jest.fn()} />)

  await waitFor(() => expect(screen.getByText('Produit non trouvé, remplis les champs à la main.')).toBeTruthy())
  expect(screen.getByTestId('fridge-form-name').props.value).toBe('')
})

test('a failed lookup shows an error, never the "not found" hint meant for a real empty result', async () => {
  const connector = new FakeFridgeConnector()
  connector.lookupProductByBarcode = jest.fn().mockRejectedValue(new Error('Impossible de contacter le serveur.'))
  await renderWithProviders(
    <FridgeFormScreen mode="create" prefillBarcode="3017620422003" onSuccess={jest.fn()} />,
    connector,
  )

  await waitFor(() =>
    expect(
      screen.getByText('La recherche du produit a échoué. Vérifie ta connexion, ou remplis les champs à la main.'),
    ).toBeTruthy(),
  )
  expect(screen.queryByText('Produit non trouvé, remplis les champs à la main.')).toBeNull()
  expect(screen.getByTestId('fridge-form-name').props.value).toBe('')
})
