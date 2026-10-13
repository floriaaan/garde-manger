import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useConnectivity } from '../../application/shared/use-connectivity.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { MutationQueue, type QueuedMutation, type SyncScope } from '../../application/sync/mutation-queue.js'
import { MutationQueueProvider } from '../../application/sync/mutation-queue-context.js'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { createFakeMutationQueueStorage } from '../../infrastructure/fake/fake-mutation-queue.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import { Result } from '../../domain/shared/result.js'
import { fakeShoppingItems } from '../../infrastructure/fake/fixtures/shopping-item.fixture.js'
import { fakeSession } from '../../infrastructure/fake/fixtures/session.fixture.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { ThemeProvider } from './theme-provider.js'
import { PendingActionsScreen } from './pending-actions-screen.js'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true }, useFocusEffect: jest.fn(),
}))
jest.mock('../../application/shared/server-config.js', () => ({ getServerUrl: () => 'https://server.example', onServerUrlChange: () => () => {} }))
jest.mock('../../application/shared/use-connectivity.js', () => ({ useConnectivity: jest.fn(() => true) }))

function setup(demo = false) {
  let disk: QueuedMutation[] = []
  let scope: SyncScope = { server: 'https://server.example', userId: fakeSession.user.id, householdId: fakeHousehold.id }
  const storage = demo ? createFakeMutationQueueStorage(scope.server) : { read: async () => disk, write: async (entries: QueuedMutation[]) => { disk = entries } }
  const send = jest.fn(async (_entry: QueuedMutation): Promise<Result<unknown, ApiError>> => Result.ok(undefined))
  const queue = new MutationQueue(storage,
    () => scope, send, () => {}, () => {})
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
  return { queue, send, client, getSession, getHousehold, changeHousehold: () => {
    scope = { ...scope, householdId: 'other' }
    client.setQueryData(['household'], { ...fakeHousehold, id: 'other' })
  } }
}

test('shows saved values and updates to empty as the local queue drains', async () => {
  const s = setup()
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  await act(async () => { await s.queue.enqueue('shopping-items', fakeShoppingItems[0], { quantity: { amount: 3, unit: 'L' } }) })
  await waitFor(() => expect(screen.getByLabelText('Quantité : 2 L, puis 3 L.')).toBeTruthy())
  expect(screen.getAllByText('À envoyer')).toHaveLength(1)
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
  await waitFor(() => expect(screen.getByText('Retirer cet article de la liste de courses.')).toBeTruthy())
  await act(() => s.changeHousehold())
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  expect(screen.queryByText(fakeShoppingItems[0].name)).toBeNull()
})

test('fake mode previews waiting, retrying, deletion and blocked actions', async () => {
  const s = setup(true)
  await waitFor(() => expect(screen.getByLabelText('Quantité : 1 L, puis 2 L.')).toBeTruthy())
  expect(screen.getByText('12 actions enregistrées')).toBeTruthy()
  expect(screen.getByText('Tes changements sont conservés')).toBeTruthy()
  expect(screen.getAllByText('Avant').length).toBeGreaterThan(1)
  expect(screen.getAllByText('Ta modification').length).toBeGreaterThan(1)
  expect(screen.getByLabelText('Emplacement : Frigo, puis Congélateur.')).toBeTruthy()
  expect(screen.getAllByText('Date d’ouverture').length).toBeGreaterThan(0)
  expect(screen.getAllByText('À envoyer').length).toBeGreaterThan(0)
  expect(screen.getAllByText(/Nouvelle tentative prévue/).length).toBeGreaterThan(0)
  expect(screen.getByText('Retirer cet article de la liste de courses.')).toBeTruthy()
  expect(await s.queue.pending()).toHaveLength(9)
  expect(await s.queue.failures()).toHaveLength(3)
  expect(screen.queryByText(/démo/i)).toBeNull()
})

test('retained failures stay separate after pending work drains, without promising automatic delivery', async () => {
  const s = setup(true)
  await waitFor(() => expect(screen.getByLabelText('Quantité : 1 L, puis 2 L.')).toBeTruthy())
  await act(async () => { await s.queue.flush(true) })
  await waitFor(() => expect(screen.getByText('Tes modifications sont conservées. Certaines actions nécessitent une vérification.')).toBeTruthy())
  expect(screen.getByRole('button', { name: 'À vérifier 3' })).toBeTruthy()
  expect(screen.getByLabelText('Emplacement : Frigo, puis Congélateur.')).toBeTruthy()
  expect(screen.queryByText('Les actions en attente seront envoyées dès que le serveur sera disponible.')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'À envoyer 0' }))
  expect(screen.getByText('Aucune action à envoyer')).toBeTruthy()
  expect(screen.queryByTestId('queued-action-4')).toBeNull()
})

test('status filters retain counts and show every assignment without expanding a row', async () => {
  setup(true)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tout 12' })).toBeTruthy())
  await fireEvent.press(screen.getByRole('button', { name: 'À vérifier 3' }))
  expect(screen.getByTestId('queued-filter-failed').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }))
  await waitFor(() => expect(screen.queryByText('Lait demi-écrémé')).toBeNull())
  expect(screen.getByRole('button', { name: 'À envoyer 9' })).toBeTruthy()
  expect(screen.getByLabelText('Emplacement : Frigo, puis Congélateur.')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'À envoyer 9' }))
  await waitFor(() => expect(screen.queryByTestId('queued-action-4')).toBeNull())
})

test('cancelling a change requires confirmation and updates scoped counts live', async () => {
  const s = setup(true)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tout 12' })).toBeTruthy())
  await fireEvent.press(screen.getByTestId('queued-cancel-1'))
  expect(await s.queue.pending()).toHaveLength(9)
  await fireEvent.press(screen.getByTestId('action-sheet-cancel'))
  expect(await s.queue.pending()).toHaveLength(9)
  await fireEvent.press(screen.getByTestId('queued-cancel-1'))
  await fireEvent.press(screen.getByTestId('queued-cancel-confirm'))
  await waitFor(() => expect(screen.queryByTestId('queued-action-1')).toBeNull())
  expect(screen.getByRole('button', { name: 'Tout 11' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'À envoyer 8' })).toBeTruthy()
  expect(await s.queue.failures()).toHaveLength(3)
})

test('retry sends the saved action and remains disabled during an outage', async () => {
  const s = setup()
  s.send.mockResolvedValueOnce(Result.err({ type: 'forbidden', message: 'Denied' }))
  await act(async () => {
    await s.queue.enqueue('shopping-items', fakeShoppingItems[0], { checked: true })
    await s.queue.flush()
  })
  const entry = (await s.queue.failures())[0]
  await waitFor(() => expect(screen.getByTestId(`queued-retry-${entry.id}`)).toBeTruthy())
  jest.mocked(useConnectivity).mockReturnValue(false)
  await act(async () => { await s.queue.flush() })
  expect(screen.getByTestId(`queued-retry-${entry.id}`)).toBeDisabled()
  await fireEvent.press(screen.getByTestId(`queued-retry-${entry.id}`))
  expect(s.send).toHaveBeenCalledTimes(1)
  jest.mocked(useConnectivity).mockReturnValue(true)
  await act(async () => { await s.queue.flush() })
  await fireEvent.press(screen.getByTestId(`queued-retry-${entry.id}`))
  await waitFor(() => expect(screen.getByText('Aucune action en attente')).toBeTruthy())
  expect(s.send).toHaveBeenCalledTimes(2)
})


test('conflict overwrite is hidden offline or while connectivity is unknown and enabled after reconnection', async () => {
  jest.mocked(useConnectivity).mockReturnValue(true)
  const s = setup(true)
  const overwrite = jest.spyOn(s.queue, 'overwrite').mockResolvedValue(undefined)
  await waitFor(() => expect(screen.getByTestId('queued-overwrite-4')).toBeTruthy())
  expect(screen.getByTestId('queued-cancel-4')).toBeTruthy()
  expect(screen.getByTestId('queued-overwrite-4')).toBeEnabled()
  expect(overwrite).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('queued-overwrite-4'))
  await waitFor(() => expect(overwrite).toHaveBeenCalledWith(4))
  jest.mocked(useConnectivity).mockReturnValue(false)
  await act(async () => { await s.queue.flush(true) })
  expect(screen.queryByTestId('queued-overwrite-4')).toBeNull()
  expect(screen.getByTestId('queued-cancel-4')).toBeTruthy()
  jest.mocked(useConnectivity).mockReturnValue(undefined)
  await act(async () => { await s.queue.flush(true) })
  expect(screen.queryByTestId('queued-overwrite-4')).toBeNull()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await act(async () => { await s.queue.flush(true) })
  await waitFor(() => expect(screen.getByTestId('queued-overwrite-4')).toBeEnabled())
  overwrite.mockRestore()
})


test('global progress advances after delivery and only the sending item has a progress bar', async () => {
  jest.mocked(useConnectivity).mockReturnValue(true)
  const s = setup()
  let finish!: () => void
  let started!: () => void
  const sending = new Promise<void>((resolve) => { started = resolve })
  s.send.mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => { finish = resolve; started() })
    return Result.ok(undefined)
  }).mockResolvedValueOnce(Result.err({ type: 'sync_conflict', message: 'Changed elsewhere' }))
  await act(async () => {
    await s.queue.enqueue('shopping-items', fakeShoppingItems[0], { checked: true })
    await s.queue.enqueue('shopping-items', { ...fakeShoppingItems[1], id: 'bread' }, { checked: true })
  })
  const [first, second] = await s.queue.pending()
  await waitFor(() => expect(screen.getByTestId('queued-global-progress')).toHaveAccessibilityValue({ min: 0, max: 2, now: 0 }))
  await waitFor(() => expect(screen.getByTestId(`queued-action-${second.id}`)).toBeTruthy())
  expect(screen.queryByTestId(`queued-progress-${first.id}`)).toBeNull()
  expect(screen.queryByTestId(`queued-progress-${second.id}`)).toBeNull()
  let replay!: Promise<void>
  await act(async () => { replay = s.queue.flush(); await sending })
  expect(screen.getByTestId(`queued-progress-${first.id}`).props.accessibilityValue).toBeUndefined()
  expect(screen.queryByTestId(`queued-progress-${second.id}`)).toBeNull()
  await act(async () => { finish(); await replay })
  await waitFor(() => expect(screen.getByTestId('queued-global-progress')).toHaveAccessibilityValue({ min: 0, max: 2, now: 1 }))
  expect(screen.getByText('1 sur 2 actions synchronisées')).toBeTruthy()
  expect(screen.queryByTestId(`queued-progress-${second.id}`)).toBeNull()
})


test('overwrite shows item progress during fresh-row preparation as well as delivery', async () => {
  jest.mocked(useConnectivity).mockReturnValue(true)
  const s = setup(true)
  let finish!: () => void
  const preparation = new Promise<void>((resolve) => { finish = resolve })
  const overwrite = jest.spyOn(s.queue, 'overwrite').mockReturnValueOnce(preparation)
  await waitFor(() => expect(screen.getByTestId('queued-overwrite-4')).toBeEnabled())
  expect(screen.queryByTestId('queued-progress-4')).toBeNull()
  await fireEvent.press(screen.getByTestId('queued-overwrite-4'))
  await waitFor(() => expect(screen.getByTestId('queued-progress-4')).toBeTruthy())
  expect(s.queue.status().sendingId).toBeNull()
  expect(screen.queryByTestId('queued-progress-11')).toBeNull()
  await act(async () => { finish(); await preparation })
  await waitFor(() => expect(screen.queryByTestId('queued-progress-4')).toBeNull())
  overwrite.mockRestore()
})
