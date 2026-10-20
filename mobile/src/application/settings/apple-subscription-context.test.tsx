import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Text, Pressable } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { AppleSubscriptionProvider, useAppleSubscription } from './apple-subscription-context.js'
import type { ApplePurchase, ApplePurchases } from '../../domain/settings/apple-purchases.js'

const purchase: ApplePurchase = { id: 'transaction-1', productId: 'com.floriaaan.gardemanger.ai.monthly', signedTransaction: 'apple-signed-jws' }

function Status() {
  const apple = useAppleSubscription()
  return <>
    <Text>{apple.product?.displayPrice ?? 'loading'}</Text>
    <Text>{apple.error}</Text>
    <Text>{apple.notice}</Text>
    <Pressable testID="buy" disabled={!apple.product || apple.pending} onPress={apple.subscribe}><Text>Buy</Text></Pressable>
    <Pressable testID="restore" onPress={apple.restore}><Text>Restore</Text></Pressable>
  </>
}

async function setup() {
  let onPurchase!: (purchase: ApplePurchase) => Promise<void>
  let onError!: (code: string) => void
  const port = {
    connect: jest.fn(async (listener: (purchase: ApplePurchase) => Promise<void>, errorListener: (code: string) => void) => { onPurchase = listener; onError = errorListener; return () => {} }),
    product: jest.fn(async () => ({ id: purchase.productId, displayPrice: '1,49 €', title: 'IA du foyer' })),
    purchase: jest.fn(async () => {}),
    restore: jest.fn(async () => [purchase]), current: jest.fn(async () => []),
    finish: jest.fn(async () => {}), manage: jest.fn(async () => {}),
  } satisfies ApplePurchases
  const connector = new FakeFridgeConnector()
  await connector.signInSocial()
  const sync = jest.spyOn(connector, 'syncAppleSubscription').mockResolvedValue({ ok: true, value: { active: true } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await render(<QueryClientProvider client={client}><ConnectorProvider connector={connector}>
    <AppleSubscriptionProvider purchases={port}><Status /></AppleSubscriptionProvider>
  </ConnectorProvider></QueryClientProvider>)
  await waitFor(() => expect(screen.getByText('1,49 €')).toBeTruthy())
  return { port, connector, sync, purchaseUpdated: () => onPurchase(purchase), purchaseError: (code: string) => onError(code) }
}

test('opens the native purchase with the server account token and finishes only after server validation', async () => {
  const { port, sync, purchaseUpdated } = await setup()
  await fireEvent.press(screen.getByTestId('buy'))
  await waitFor(() => expect(port.purchase).toHaveBeenCalledWith(purchase.productId, '00000000-0000-4000-8000-000000000001'))
  expect(sync).not.toHaveBeenCalled()
  expect(port.finish).not.toHaveBeenCalled()
  await act(purchaseUpdated)
  expect(sync).toHaveBeenCalledWith('apple-signed-jws')
  expect(port.finish).toHaveBeenCalledWith(purchase)
  expect(sync.mock.invocationCallOrder[0]).toBeLessThan(port.finish.mock.invocationCallOrder[0])
})

test('a failed backend verification leaves the native transaction unfinished and restorable', async () => {
  const { port, sync, purchaseUpdated } = await setup()
  sync.mockResolvedValueOnce({ ok: false, error: { type: 'network_error', message: 'Validation indisponible.' } })
  await act(purchaseUpdated)
  expect(port.finish).not.toHaveBeenCalled()
  expect(screen.getByText('Validation indisponible.')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('restore'))
  await waitFor(() => expect(port.finish).toHaveBeenCalledWith(purchase))
  expect(port.restore).toHaveBeenCalledTimes(1)
})

test('cancellation unlocks the UI and a pending approval does not grant access', async () => {
  const { sync, port, purchaseError } = await setup()
  await fireEvent.press(screen.getByTestId('buy'))
  await waitFor(() => expect(port.purchase).toHaveBeenCalledTimes(1))
  await act(async () => purchaseError('user-cancelled'))
  expect(screen.getByTestId('buy').props.disabled).toBe(false)
  await act(async () => purchaseError('pending'))
  expect(sync).not.toHaveBeenCalled()
  expect(port.finish).not.toHaveBeenCalled()
})

test('an existing household subscription blocks a second native purchase', async () => {
  const { port, connector } = await setup()
  jest.spyOn(connector, 'getAppleSubscription').mockResolvedValue({ ok: true, value: { productId: purchase.productId, appAccountToken: 'account-1', canPurchase: false } })
  await fireEvent.press(screen.getByTestId('buy'))
  await waitFor(() => expect(screen.getByText('Ce foyer dispose déjà d’un abonnement actif.')).toBeTruthy())
  expect(port.purchase).not.toHaveBeenCalled()
})
