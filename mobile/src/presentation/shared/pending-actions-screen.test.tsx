import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { MutationQueue, type QueuedMutation, type SyncScope } from '../../application/sync/mutation-queue.js'
import { MutationQueueProvider } from '../../application/sync/mutation-queue-context.js'
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

function setup() {
  let disk: QueuedMutation[] = []
  let scope: SyncScope = { server: 'https://server.example', userId: fakeSession.user.id, householdId: fakeHousehold.id }
  const queue = new MutationQueue({ read: async () => disk, write: async (entries) => { disk = entries } },
    () => scope, async () => Result.ok(undefined), () => {}, () => {})
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(['session'], fakeSession)
  client.setQueryData(['household'], fakeHousehold)
  render(<ThemeProvider><QueryClientProvider client={client}>
    <MutationQueueProvider queue={queue}><PendingActionsScreen /></MutationQueueProvider>
  </QueryClientProvider></ThemeProvider>)
  return { queue, client, changeHousehold: () => {
    scope = { ...scope, householdId: 'other' }
    client.setQueryData(['household'], { ...fakeHousehold, id: 'other' })
  } }
}

test('shows saved values and updates to empty as the local queue drains', async () => {
  const s = setup()
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  await act(async () => { await s.queue.enqueue('shopping-items', fakeShoppingItems[0], { quantity: { amount: 3, unit: 'L' } }) })
  await waitFor(() => expect(screen.getByText('Quantité : 3 L')).toBeTruthy())
  expect(screen.getByText('En attente de synchronisation')).toBeTruthy()
  await act(async () => { await s.queue.flush() })
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }))
  expect(router.back).toHaveBeenCalled()
})

test('changing households hides the previous household queue', async () => {
  const s = setup()
  await act(async () => { await s.queue.enqueue('shopping-items', fakeShoppingItems[0], null) })
  await waitFor(() => expect(screen.getByText('Courses · Suppression')).toBeTruthy())
  await act(() => s.changeHousehold())
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  expect(screen.queryByText(fakeShoppingItems[0].name)).toBeNull()
})
