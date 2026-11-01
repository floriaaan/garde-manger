import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Linking } from 'react-native'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { SettingsScreen } from './settings-screen.js'
import { setLocaleOverride } from '../../i18n/index.js'
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('../../application/shared/toast.js', () => ({ showToast: jest.fn() }))

// Replaying the tour saves the opt-in before returning to the dashboard.
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

test('opens product feedback from an accessible Settings entry', async () => {
  await renderAuthenticated()
  fireEvent.press(screen.getByRole('button', { name: 'Donner mon avis' }))
  expect(router.push).toHaveBeenCalledWith('/feedback')
})

test('shows the app version in the À propos line', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByText(/Garde-manger · v/)).toBeTruthy())
})

test('links to the privacy policy and the terms of use (App Store 5.1.1(i))', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('settings-privacy-policy')).toBeTruthy())
  fireEvent.press(screen.getByTestId('settings-privacy-policy'))
  fireEvent.press(screen.getByTestId('settings-terms'))

  expect(openURL).toHaveBeenCalledWith('https://gardemanger.floriaaan.fr/privacy')
  expect(openURL).toHaveBeenCalledWith('https://gardemanger.floriaaan.fr/cgu')
  openURL.mockRestore()
})

test('tapping the AI card opens the provider page', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('settings-ai-provider')).toBeTruthy())
  fireEvent.press(screen.getByTestId('settings-ai-provider'))

  expect(router.push).toHaveBeenCalledWith('/ai-provider')
})

// The Home Assistant entry point moved to /household (see
// household-screen.test.tsx) — it's a foyer-scoped setting, not an
// account-scoped one, so it lives on the Foyer page next to invite/members
// rather than on Réglages.

afterEach(() => setLocaleOverride(null))
