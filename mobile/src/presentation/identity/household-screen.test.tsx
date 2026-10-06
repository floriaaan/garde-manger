import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeHousehold, fakeHouseholdAsMember } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { router } from 'expo-router'
import { ThemeProvider } from '../shared/theme-provider.js'
import { HouseholdScreen } from './household-screen.js'
import { Result } from '../../domain/shared/result.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
}))

// Expose the existing refresh control, following the shopping-list tests.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native')
  const { createElement } = require('react')
  function MockRefreshControl(props: Record<string, unknown>) {
    return createElement('RefreshControl', { testID: 'household-refresh-control', ...props })
  }
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === 'RefreshControl') return MockRefreshControl
      return Reflect.get(target, prop, receiver)
    },
  })
})

async function renderHousehold(connector = new FakeFridgeConnector()) {
  await connector.signInSocial()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <HouseholdScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

test('names the household and lists its members', async () => {
  await renderHousehold()

  await waitFor(() => expect(screen.getByTestId('household-name')).toHaveTextContent('Appartement des loulous'))
  expect(screen.getByTestId('household-member-fake-user-1')).toBeTruthy()
  expect(screen.getByTestId('household-member-fake-user-2')).toBeTruthy()
  expect(screen.getByLabelText('Avatar de Thomas C.')).toBeTruthy()
  expect(screen.getByLabelText('Avatar de Camille')).toBeTruthy()
})

test('an owner sees the invite code and can rotate it', async () => {
  await renderHousehold()

  await waitFor(() => expect(screen.getByTestId('household-invite-code')).toHaveTextContent('K4Q2M7XP'))

  await fireEvent.press(screen.getByTestId('household-regenerate'))

  await waitFor(() => expect(screen.getByTestId('household-invite-code')).toHaveTextContent('FAKE0001'))
})

test('a member without an invite code never sees that section', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getHousehold').mockResolvedValue({
    id: 'h1',
    name: 'Coloc du 3e',
    role: 'member',
    members: [{ userId: 'fake-user-1', name: 'Demo User', role: 'member', joinedAt: '2026-08-01T09:00:00.000Z' }],
  })
  await renderHousehold(connector)

  await waitFor(() => expect(screen.getByTestId('household-name')).toHaveTextContent('Coloc du 3e'))
  expect(screen.queryByTestId('household-invite-code')).toBeNull()
})

test('removing a member asks first, then removes', async () => {
  const connector = await renderHousehold()
  const removeSpy = jest.spyOn(connector, 'removeHouseholdMember')

  await waitFor(() => expect(screen.getByTestId('household-remove-fake-user-2')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('household-remove-fake-user-2'))
  expect(removeSpy).not.toHaveBeenCalled()

  await fireEvent.press(screen.getByTestId('household-remove-confirm'))

  await waitFor(() => expect(removeSpy).toHaveBeenCalledWith('fake-user-2'))
})

test('a sole owner cannot open the leave or delete action', async () => {
  const connector = new FakeFridgeConnector({
    fixtureHousehold: { ...fakeHousehold, members: [fakeHousehold.members[0]!] },
  })
  const leaveSpy = jest.spyOn(connector, 'leaveHousehold')
  await renderHousehold(connector)

  await waitFor(() => expect(screen.getByTestId('household-name')).toBeTruthy())
  expect(screen.queryByTestId('household-leave')).toBeNull()
  expect(screen.queryByTestId('household-leave-confirm')).toBeNull()
  expect(screen.queryByTestId('household-transfer-ownership')).toBeNull()
  expect(screen.getByTestId('household-owner-leave-help')).toHaveTextContent('un autre membre doit d’abord te rejoindre')
  expect(leaveSpy).not.toHaveBeenCalled()
  expect(await connector.getHousehold()).toEqual({ ...fakeHousehold, members: [fakeHousehold.members[0]!] })
})

test('an owner can leave only after transferring ownership', async () => {
  const connector = await renderHousehold()
  const leaveSpy = jest.spyOn(connector, 'leaveHousehold')
  const transferSpy = jest.spyOn(connector, 'transferHouseholdOwnership')

  await waitFor(() => expect(screen.getByTestId('household-transfer-ownership')).toBeTruthy())
  expect(screen.queryByTestId('household-leave')).toBeNull()
  expect(screen.queryByTestId('household-leave-confirm')).toBeNull()
  expect(leaveSpy).not.toHaveBeenCalled()
  expect(screen.getByTestId('household-owner-leave-help')).toHaveTextContent('transfère d’abord la propriété')

  await fireEvent.press(screen.getByTestId('household-transfer-ownership'))
  await fireEvent.press(screen.getByTestId('household-transfer-target-fake-user-2'))
  expect(transferSpy).not.toHaveBeenCalled()
  expect(screen.getByText('Transférer la propriété à Camille ?')).toBeTruthy()
  expect(screen.getByText(/Tu perdras ces droits/)).toBeTruthy()
  await fireEvent.press(screen.getByTestId('household-transfer-confirm'))

  await waitFor(() => expect(screen.getByTestId('household-leave')).toBeTruthy())
  expect(screen.queryByTestId('household-transfer-ownership')).toBeNull()
  expect(await connector.getHousehold()).toMatchObject({
    id: fakeHousehold.id,
    role: 'member',
    members: [
      { userId: 'fake-user-1', role: 'member' },
      { userId: 'fake-user-2', role: 'owner' },
    ],
  })
})

test('cancelling the recipient confirmation preserves ownership and membership', async () => {
  const connector = await renderHousehold()
  const transferSpy = jest.spyOn(connector, 'transferHouseholdOwnership')
  await waitFor(() => expect(screen.getByTestId('household-transfer-ownership')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('household-transfer-ownership'))
  await fireEvent.press(screen.getByTestId('household-transfer-target-fake-user-2'))
  await fireEvent.press(screen.getByTestId('action-sheet-cancel'))
  expect(transferSpy).not.toHaveBeenCalled()
  expect(screen.queryByTestId('household-transfer-confirm')).toBeNull()
  expect(await connector.getHousehold()).toEqual(fakeHousehold)
})

test.each([
  ['removeHouseholdMember', 'household-remove-fake-user-2', 'household-remove-confirm', 'Retrait du membre en cours…'],
  ['transferHouseholdOwnership', 'household-transfer-ownership', 'household-transfer-confirm', 'Transfert de propriété en cours…'],
  ['leaveHousehold', 'household-leave', 'household-leave-confirm', 'Départ du foyer en cours…'],
] as const)('%s shows progress, prevents duplicate requests and allows retry after refusal', async (method, opener, confirm, status) => {
  const connector = new FakeFridgeConnector({ fixtureHousehold: method === 'leaveHousehold' ? fakeHouseholdAsMember : fakeHousehold })
  let finish!: () => void
  const gate = new Promise<void>((resolve) => { finish = resolve })
  const mutation = jest.spyOn(connector, method).mockImplementationOnce(async () => {
    await gate
    return Result.err({ type: 'unavailable', message: 'Opération indisponible. Réessaie.' })
  })
  await renderHousehold(connector)
  await waitFor(() => expect(screen.getByTestId(opener)).toBeTruthy())
  await fireEvent.press(screen.getByTestId(opener))
  if (method === 'transferHouseholdOwnership') {
    await fireEvent.press(screen.getByTestId('household-transfer-target-fake-user-2'))
  }
  fireEvent.press(screen.getByTestId(confirm))
  await waitFor(() => expect(screen.getByTestId('household-action-status')).toHaveTextContent(status))
  expect(screen.getByTestId(confirm)).toBeDisabled()
  expect(screen.getByTestId(`${confirm}-spinner`)).toBeTruthy()
  expect(screen.getByLabelText('Fermer')).toBeTruthy()
  await fireEvent.press(screen.getByTestId(confirm))
  expect(mutation).toHaveBeenCalledTimes(1)

  await act(async () => { finish(); await gate })
  await waitFor(() => expect(screen.getByTestId('household-action-error')).toHaveTextContent('Opération indisponible. Réessaie.'))
  expect(screen.getByTestId(confirm)).not.toBeDisabled()
  expect(screen.queryByTestId('household-action-status')).toBeNull()
  await fireEvent.press(screen.getByTestId(confirm))
  await waitFor(() => expect(screen.queryByTestId(confirm)).toBeNull())
  expect(mutation).toHaveBeenCalledTimes(2)
})

test('a rejected transfer keeps the confirmation open with an actionable error', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'transferHouseholdOwnership').mockRejectedValueOnce(new Error('offline'))
  await renderHousehold(connector)
  await waitFor(() => expect(screen.getByTestId('household-transfer-ownership')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('household-transfer-ownership'))
  await fireEvent.press(screen.getByTestId('household-transfer-target-fake-user-2'))
  await fireEvent.press(screen.getByTestId('household-transfer-confirm'))
  await waitFor(() => expect(screen.getByTestId('household-action-error')).toHaveTextContent('Vérifie ta connexion et réessaie.'))
  expect(screen.getByTestId('household-transfer-confirm')).not.toBeDisabled()
  expect(await connector.getHousehold()).toEqual(fakeHousehold)
})

test('renaming is disclosed on demand and closes after a successful save', async () => {
  const connector = await renderHousehold()
  await waitFor(() => expect(screen.getByTestId('household-rename-open')).toBeTruthy())
  expect(screen.queryByTestId('household-rename-field')).toBeNull()
  await fireEvent.press(screen.getByTestId('household-rename-open'))
  await fireEvent.changeText(screen.getByTestId('household-rename-field'), 'Chez nous')
  await fireEvent.press(screen.getByTestId('household-rename-cancel'))
  expect((await connector.getHousehold())?.name).toBe(fakeHousehold.name)
  await fireEvent.press(screen.getByTestId('household-rename-open'))
  expect(screen.getByTestId('household-rename-field').props.value).toBe(fakeHousehold.name)
  await fireEvent.changeText(screen.getByTestId('household-rename-field'), 'Chez nous')
  await fireEvent.press(screen.getByTestId('household-rename-save'))
  await waitFor(() => expect(screen.getByTestId('household-name')).toHaveTextContent('Chez nous'))
  await waitFor(() => expect(screen.queryByTestId('household-rename-field')).toBeNull())
})

test('Home Assistant loading and failure are distinct from an unconfigured connection', async () => {
  const connector = new FakeFridgeConnector()
  let finish!: () => void
  const gate = new Promise<void>((resolve) => { finish = resolve })
  const read = jest.spyOn(connector, 'getHaLink').mockImplementationOnce(async () => {
    await gate
    throw new Error('offline')
  }).mockResolvedValue(null)
  await renderHousehold(connector)
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  expect(screen.getByLabelText('Home Assistant. Chargement…')).toBeTruthy()
  expect(screen.queryByText('Non configuré')).toBeNull()
  await act(async () => { finish(); await gate })
  await waitFor(() => expect(screen.getByLabelText('Home Assistant. État indisponible')).toBeTruthy())
  expect(screen.queryByText('Non configuré')).toBeNull()
  await fireEvent.press(screen.getByTestId('household-ha-retry'))
  await waitFor(() => expect(screen.getByLabelText('Home Assistant. Non configuré')).toBeTruthy())
})

test('pull-to-refresh reloads household and Home Assistant state together', async () => {
  const connector = await renderHousehold()
  await waitFor(() => expect(screen.getByLabelText('Home Assistant. Non configuré')).toBeTruthy())
  const householdRead = jest.spyOn(connector, 'getHousehold')
  const haRead = jest.spyOn(connector, 'getHaLink')
  await act(async () => { screen.getByTestId('household-refresh-control').props.onRefresh() })
  await waitFor(() => {
    expect(householdRead).toHaveBeenCalledTimes(1)
    expect(haRead).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('household-refresh-control').props.refreshing).toBe(false)
  })
})

test('a saved Home Assistant connection without a bound list asks for a list', async () => {
  const connector = new FakeFridgeConnector()
  const link = await connector.getHaLink()
  jest.spyOn(connector, 'getHaLink').mockResolvedValue({ ...link!, configured: true })
  await renderHousehold(connector)
  await waitFor(() => expect(screen.getByLabelText('Home Assistant. Liste à choisir')).toBeTruthy())
  expect(screen.queryByText('Non configuré')).toBeNull()
})

test('a member confirms leaving before returning to onboarding', async () => {
  const connector = new FakeFridgeConnector({ fixtureHousehold: fakeHouseholdAsMember })
  const leaveSpy = jest.spyOn(connector, 'leaveHousehold')
  jest.mocked(router.replace).mockClear()
  await renderHousehold(connector)

  await waitFor(() => expect(screen.getByTestId('household-leave')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('household-leave'))

  expect(screen.getByText('Tu perdras l’accès au garde-manger, aux courses et aux recettes du foyer.')).toBeTruthy()
  expect(screen.queryByText('Supprimer le foyer')).toBeNull()
  expect(leaveSpy).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('household-leave-confirm'))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(onboarding)'))
  expect(leaveSpy).toHaveBeenCalledTimes(1)
  expect(await connector.getHousehold()).toBeNull()
})

test('shows the Home Assistant row for a foyer owner', async () => {
  await renderHousehold()
  await waitFor(() => expect(screen.getByText('Maison connectée')).toBeTruthy())
  expect(screen.getByTestId('ha-settings-row')).toBeTruthy()
})

test('hides the Home Assistant row for a foyer member', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getHousehold').mockResolvedValue({
    id: 'h1',
    name: 'Coloc du 3e',
    role: 'member',
    members: [{ userId: 'fake-user-1', name: 'Demo User', role: 'member', joinedAt: '2026-08-01T09:00:00.000Z' }],
  })
  await renderHousehold(connector)

  await waitFor(() => expect(screen.getByTestId('household-name')).toHaveTextContent('Coloc du 3e'))
  expect(screen.queryByText('Maison connectée')).toBeNull()
})
