import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { MutationQueue, type QueuedMutation, type SyncScope } from '../../application/sync/mutation-queue.js'
import { MutationQueueProvider } from '../../application/sync/mutation-queue-context.js'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { createFakeMutationQueue } from '../../infrastructure/fake/fake-mutation-queue.js'
import { Result } from '../../domain/shared/result.js'
import { fakeShoppingItems } from '../../infrastructure/fake/fixtures/shopping-item.fixture.js'
import { fakeSession } from '../../infrastructure/fake/fixtures/session.fixture.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { ThemeProvider } from './theme-provider.js'
import { PendingActionsScreen } from './pending-actions-screen.js'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true }, useFocusEffect: jest.fn(),
}))
jest.mock('../../application/shared/server-config.js', () => ({ getServerUrl: () => 'https://server.example' }))

function setup(demo = false) {
  let disk: QueuedMutation[] = []
  let scope: SyncScope = { server: 'https://server.example', userId: fakeSession.user.id, householdId: fakeHousehold.id }
  const queue = demo ? createFakeMutationQueue(scope.server, () => scope) : new MutationQueue({ read: async () => disk, write: async (entries) => { disk = entries } },
    () => scope, async () => Result.ok(undefined), () => {}, () => {})
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(['session'], fakeSession)
  client.setQueryData(['household'], fakeHousehold)
  const connector = new FakeFridgeConnector()
  const getSession = jest.spyOn(connector, 'getSession')
  const getHousehold = jest.spyOn(connector, 'getHousehold')
  render(<ThemeProvider><QueryClientProvider client={client}>
    <ConnectorProvider connector={connector}>
    <MutationQueueProvider queue={queue}><PendingActionsScreen /></MutationQueueProvider>
    </ConnectorProvider>
  </QueryClientProvider></ThemeProvider>)
  return { queue, client, getSession, getHousehold, changeHousehold: () => {
    scope = { ...scope, householdId: 'other' }
    client.setQueryData(['household'], { ...fakeHousehold, id: 'other' })
  } }
}

test('shows saved values and updates to empty as the local queue drains', async () => {
  const s = setup()
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  await act(async () => { await s.queue.enqueue('shopping-items', fakeShoppingItems[0], { quantity: { amount: 3, unit: 'L' } }) })
  await waitFor(() => expect(screen.getByText('Quantité : 3 L')).toBeTruthy())
  expect(screen.getAllByText('En attente de synchronisation')).toHaveLength(1)
  await act(async () => { await s.queue.flush() })
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }))
  expect(router.back).toHaveBeenCalled()
})

test('opening the modal observes identity cache without missing-queryFn errors or network reads', async () => {
  const errors = jest.spyOn(console, 'error')
  try {
    const s = setup()
    await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
    expect(s.getSession).not.toHaveBeenCalled()
    expect(s.getHousehold).not.toHaveBeenCalled()
    expect(errors.mock.calls.filter((args) => args.some((arg) => String(arg).includes('No queryFn')))).toEqual([])
  } finally {
    errors.mockRestore()
  }
})

test('changing households hides the previous household queue', async () => {
  const s = setup()
  await act(async () => { await s.queue.enqueue('shopping-items', fakeShoppingItems[0], null) })
  await waitFor(() => expect(screen.getByText('Courses · Suppression')).toBeTruthy())
  await act(() => s.changeHousehold())
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  expect(screen.queryByText(fakeShoppingItems[0].name)).toBeNull()
})

test('fake mode previews waiting, retrying, deletion and blocked actions', async () => {
  setup(true)
  await waitFor(() => expect(screen.getByText('Quantité : 2 L')).toBeTruthy())
  expect(screen.getAllByText('En attente de synchronisation')).toHaveLength(2)
  expect(screen.getByText('Nouvelle tentative prévue')).toBeTruthy()
  expect(screen.getByText('Courses · Suppression')).toBeTruthy()
  expect(screen.getByText('Action bloquée')).toBeTruthy()
})
