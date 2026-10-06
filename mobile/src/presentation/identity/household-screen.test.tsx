import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeHousehold, fakeHouseholdAsMember } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { router } from 'expo-router'
import { ThemeProvider } from '../shared/theme-provider.js'
import { HouseholdScreen } from './household-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
}))

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
  expect(leaveSpy).not.toHaveBeenCalled()
  expect(await connector.getHousehold()).toEqual({ ...fakeHousehold, members: [fakeHousehold.members[0]!] })
})

test('an owner can leave only after transferring ownership', async () => {
  const connector = await renderHousehold()
  const leaveSpy = jest.spyOn(connector, 'leaveHousehold')

  await waitFor(() => expect(screen.getByTestId('household-transfer-ownership')).toBeTruthy())
  expect(screen.queryByTestId('household-leave')).toBeNull()
  expect(screen.queryByTestId('household-leave-confirm')).toBeNull()
  expect(leaveSpy).not.toHaveBeenCalled()

  await fireEvent.press(screen.getByTestId('household-transfer-ownership'))
  await fireEvent.press(screen.getByTestId('household-transfer-target-fake-user-2'))

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
