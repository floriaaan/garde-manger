import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeProducts } from '../../infrastructure/fake/fixtures/product.fixture.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ProductRestockSheet } from './product-restock-sheet.js'

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }))

const milk = fakeProducts.find((product) => product.id === 'fake-product-1')!

async function setup({
  connector = new FakeFridgeConnector(),
  product = milk,
  finish = true,
  onFinish = jest.fn(async () => true),
  ready = true,
} = {}) {
  const onComplete = jest.fn()
  const onClose = jest.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ConnectorProvider connector={connector}>
          <ProductRestockSheet
            product={product}
            finish={finish}
            onFinish={onFinish}
            onComplete={onComplete}
            onClose={onClose}
          />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  if (ready)
    await waitFor(() =>
      expect(screen.getByTestId('restock-confirm').props.accessibilityState.disabled).toBe(false),
    )
  return { connector, onFinish, onComplete, onClose }
}

test('reference quantity is prefilled, with a usable fallback for zero and missing units', async () => {
  await setup({
    product: {
      ...milk,
      name: 'Produit sans unité',
      initialQuantity: 0,
      quantity: { amount: 0, unit: '' },
    },
  })
  expect(screen.getByTestId('restock-amount').props.value).toBe('1')
  expect(screen.getByTestId('restock-unit').props.value).toBe('pièce')
})

test('uses reference stock rather than the last remaining unit', async () => {
  await setup({
    product: {
      ...milk,
      name: 'Nouveau produit',
      initialQuantity: 6,
      quantity: { amount: 1, unit: 'pièces' },
    },
  })
  expect(screen.getByTestId('restock-amount').props.value).toBe('6')
})

test('an existing item is kept explicitly, without summing or consuming before validation', async () => {
  const { connector, onFinish, onComplete } = await setup()
  expect(screen.getByTestId('restock-amount').props.value).toBe('2')
  expect(onFinish).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('restock-keep'))
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true))
  expect(onFinish).toHaveBeenCalledWith(
    true,
    expect.objectContaining({ kind: 'consumed', amount: 1, operationId: expect.any(String) }),
  )
  const items = (await connector.getShoppingItems()).filter((item) => item.name === milk.name)
  expect(items).toHaveLength(1)
  expect(items[0].quantity.amount).toBe(2)
})

test('changing the quantity replaces the total and does not consume when adding from stock', async () => {
  const { connector, onFinish, onComplete } = await setup({ finish: false })
  await fireEvent.changeText(screen.getByTestId('restock-amount'), '3')
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true))
  expect(onFinish).not.toHaveBeenCalled()
  expect(
    (await connector.getShoppingItems()).find((item) => item.name === milk.name)?.quantity.amount,
  ).toBe(3)
  expect(await connector.getProduct(milk.id)).not.toBeNull()
})

test('cancelling and finishing only never add a shopping item', async () => {
  const connector = new FakeFridgeConnector()
  const add = jest.spyOn(connector, 'createShoppingItem')
  const { onClose, onComplete, onFinish } = await setup({ connector })
  await fireEvent.press(screen.getByTestId('action-sheet-cancel'))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(add).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('restock-finish-only'))
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(false))
  expect(onFinish).toHaveBeenCalledWith(
    false,
    expect.objectContaining({ kind: 'consumed', amount: 1, operationId: expect.any(String) }),
  )
  expect(add).not.toHaveBeenCalled()
})

test('a failed shopping write leaves inventory untouched and reports no success', async () => {
  const connector = new FakeFridgeConnector()
  jest
    .spyOn(connector, 'createShoppingItem')
    .mockResolvedValue({ ok: false, error: { type: 'network', message: 'Hors ligne' } })
  const { onFinish, onComplete } = await setup({ connector })
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(screen.getByTestId('restock-error')).toHaveTextContent('Hors ligne'))
  expect(onFinish).not.toHaveBeenCalled()
  expect(onComplete).not.toHaveBeenCalled()
  expect(await connector.getProduct(milk.id)).not.toBeNull()
})

test('retry after consumption failure does not repeat the shopping write; double press is ignored', async () => {
  const connector = new FakeFridgeConnector()
  const add = jest.spyOn(connector, 'createShoppingItem')
  const onFinish = jest.fn(async () => true).mockResolvedValueOnce(false)
  const { onComplete } = await setup({ connector, onFinish })
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(screen.getByTestId('restock-error')).toBeTruthy())
  expect(onComplete).not.toHaveBeenCalled()
  expect(add).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true))
  expect(add).toHaveBeenCalledTimes(1)
  expect(onFinish).toHaveBeenCalledTimes(2)
})

test('an item added since the read asks for a new duplicate decision', async () => {
  const connector = new FakeFridgeConnector()
  const product = { ...milk, name: 'Nouveau lait' }
  const { onFinish, onComplete } = await setup({ connector, product })
  await connector.createShoppingItem({
    name: product.name,
    quantity: { amount: 4, unit: 'L' },
    source: 'manual',
  })
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  await waitFor(() => expect(screen.getByTestId('restock-existing')).toBeTruthy())
  expect(onFinish).not.toHaveBeenCalled()
  expect(onComplete).not.toHaveBeenCalled()
  expect(screen.getByTestId('restock-amount').props.value).toBe('4')
  await fireEvent.press(screen.getByTestId('restock-keep'))
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true))
  expect(
    (await connector.getShoppingItems()).filter((item) => item.name === product.name),
  ).toHaveLength(1)
})

test('zero quantity is rejected before writing or consuming', async () => {
  const connector = new FakeFridgeConnector()
  const add = jest.spyOn(connector, 'createShoppingItem')
  const { onFinish } = await setup({ connector })
  await fireEvent.changeText(screen.getByTestId('restock-amount'), '0')
  await fireEvent.press(screen.getByTestId('restock-confirm'))
  expect(screen.getByTestId('restock-error')).toBeTruthy()
  expect(add).not.toHaveBeenCalled()
  expect(onFinish).not.toHaveBeenCalled()
})

test('a failed list read blocks adding and offers a retry', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getShoppingItems').mockRejectedValueOnce(new Error('Hors ligne'))
  const add = jest.spyOn(connector, 'createShoppingItem')
  const { onFinish } = await setup({ connector, ready: false })
  await waitFor(() => expect(screen.getByTestId('restock-reload')).toBeTruthy())
  expect(screen.getByTestId('restock-confirm').props.accessibilityState.disabled).toBe(true)
  expect(add).not.toHaveBeenCalled()
  expect(onFinish).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('restock-reload'))
  await waitFor(() =>
    expect(screen.getByTestId('restock-confirm').props.accessibilityState.disabled).toBe(false),
  )
})
