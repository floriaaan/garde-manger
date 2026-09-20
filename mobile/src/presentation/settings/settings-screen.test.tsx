import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { SettingsScreen } from './settings-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

// Only the debug menu's "Réinitialiser l'onboarding" row touches the
// keychain (via `resetWelcomeSeen`) — nothing else on this screen does, so
// no other test here depended on this mock existing before it did.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

async function renderAuthenticated(connector = new FakeFridgeConnector()) {
  // Signed out by default (see fake-fridge-connector.ts) — the account
  // card needs a real session to show a real name/email.
  await connector.signInSocial()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <SettingsScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('shows the signed-in user and the household on their own cards', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByText('Thomas')).toBeTruthy())
  expect(screen.getByText('demo@example.com')).toBeTruthy()
})

test('the foyer card carries the whole width, its members and the role — not a truncated name', async () => {
  await renderAuthenticated()

  // The name, not the testID: the card renders straight away with a "—"
  // placeholder while the household query is in flight.
  await waitFor(() => expect(screen.getByText('Appartement des loulous')).toBeTruthy())

  expect(screen.getByText('2 membres')).toBeTruthy()
  expect(screen.getByText('Propriétaire')).toBeTruthy()

  fireEvent.press(screen.getByTestId('settings-household'))

  expect(router.push).toHaveBeenCalledWith('/household')
})

test('tapping the account card opens Mon compte', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('settings-account')).toBeTruthy())
  fireEvent.press(screen.getByTestId('settings-account'))

  expect(router.push).toHaveBeenCalledWith('/account')
})

test('shows the app version in the À propos line', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByText(/Garde-manger · v/)).toBeTruthy())
})

test('tapping the AI card opens the provider page', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('settings-ai-provider')).toBeTruthy())
  fireEvent.press(screen.getByTestId('settings-ai-provider'))

  expect(router.push).toHaveBeenCalledWith('/ai-provider')
})

test('does not file the receipt history under settings — it is content, and it lives on the dashboard now', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('sign-out')).toBeTruthy())

  expect(screen.queryByTestId('settings-receipts-history')).toBeNull()
  expect(screen.queryByText('Historique des tickets')).toBeNull()
})

test('signing out clears the session and returns to sign-in', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('sign-out')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('sign-out'))

  // Confirmed, like every other consequential action — a shared kitchen tablet
  // is the scene a bare sign-out button fails in.
  await waitFor(() => expect(screen.getByTestId('sign-out-confirm')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('sign-out-confirm'))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-in'))
})

test('a foyer that could not be read is unavailable, not absent', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getHousehold').mockRejectedValue(new Error('network'))

  await renderAuthenticated(connector)

  await waitFor(() => expect(screen.getByText('Foyer indisponible')).toBeTruthy())
  // "Aucun foyer" is a fact about the account; a failed read is a fact about
  // the network. Printing the first for the second invents a state.
  expect(screen.queryByText('Aucun foyer')).toBeNull()
})

// The Home Assistant entry point moved to /household (see
// household-screen.test.tsx) — it's a foyer-scoped setting, not an
// account-scoped one, so it lives on the Foyer page next to invite/members
// rather than on Réglages.

test('the debug entry opens the debug screen', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('debug-menu-open')).toBeTruthy())
  fireEvent.press(screen.getByTestId('debug-menu-open'))

  expect(router.push).toHaveBeenCalledWith('/debug')
})

test('shows the instance card with the name, without the raw server URL or version', async () => {
  const connector = new FakeFridgeConnector()
  jest
    .spyOn(connector, 'getInstanceInfo')
    .mockResolvedValue({ mode: 'self-hosted', name: 'Garde-manger de test', version: '0.0.0' })

  await renderAuthenticated(connector)

  await waitFor(() => expect(screen.getByText('Garde-manger de test')).toBeTruthy())
  // Technical detail — that's what "Changer de serveur" is for now.
  expect(screen.queryByText(/v0\.0\.0/)).toBeNull()
})

test('tapping the instance card opens the server-info page', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('settings-instance')).toBeTruthy())
  fireEvent.press(screen.getByTestId('settings-instance'))

  expect(router.push).toHaveBeenCalledWith('/server-info')
})
