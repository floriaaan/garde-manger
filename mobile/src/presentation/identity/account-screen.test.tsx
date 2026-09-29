import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { fakeHouseholdAsMember } from '../../infrastructure/fake/fixtures/household.fixture.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { AccountScreen } from './account-screen.js'
import { DeleteAccountScreen } from './delete-account-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

async function renderAuthenticated(connector = new FakeFridgeConnector(), Page = AccountScreen) {
  await connector.signInSocial()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <Page />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('shows the signed-in user identity', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByText('demo@example.com')).toBeTruthy())
  expect(screen.getByDisplayValue('Thomas')).toBeTruthy()
})

test('lists the linked connection methods', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByText('Email et mot de passe')).toBeTruthy())
  expect(screen.getByText('PocketID')).toBeTruthy()
})

test('saving a new name calls the connector and shows a success hint', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('account-name')).toBeTruthy())
  await fireEvent.changeText(screen.getByTestId('account-name'), 'Nouveau nom')
  await fireEvent.press(screen.getByTestId('account-save-name'))

  await waitFor(() => expect(screen.getByText('Nom mis à jour')).toBeTruthy())
})

test('account deletion opens its own page', async () => {
  await renderAuthenticated()
  await fireEvent.press(screen.getByTestId('account-delete'))

  expect(router.push).toHaveBeenCalledWith('/delete-account')
})

test('an owner of a shared household is blocked from deleting and offered the foyer instead', async () => {
  await renderAuthenticated(new FakeFridgeConnector(), DeleteAccountScreen)

  await waitFor(() => expect(screen.getByTestId('account-go-to-household')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('account-go-to-household'))

  expect(router.push).toHaveBeenCalledWith('/household')
})

test('a plain member can delete their account after confirming with their password', async () => {
  const connector = new FakeFridgeConnector({ fixtureHousehold: fakeHouseholdAsMember })
  await renderAuthenticated(connector, DeleteAccountScreen)

  await waitFor(() => expect(screen.getByTestId('account-delete-password')).toBeTruthy())
  await fireEvent.changeText(screen.getByTestId('account-delete-password'), 'correct-horse-battery-staple')
  await fireEvent.press(screen.getByTestId('account-delete-confirm'))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-in'))
})
