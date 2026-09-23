/**
 * ADR 0020: Google sign-in needs Sign in with Apple next to it on iOS
 * (App Store 4.8). Until that ships, iOS hides Google at sign-in and at
 * account linking; Android and web keep it.
 */
import { render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { AuthMethodFooter } from './auth-method-footer.js'
import { AccountScreen } from './account-screen.js'
import type { PlatformCapabilities } from '../../domain/shared/platform-capabilities.js'

const mockCapabilities: PlatformCapabilities = { billing: true, googleSignIn: true }
// A getter: the factory runs during the imports above, before `mockCapabilities` is initialised.
jest.mock('../../application/shared/platform-capabilities.js', () => ({
  get platformCapabilities() {
    return mockCapabilities
  },
}))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

function connectorOfferingGoogle() {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getAuthMethods').mockResolvedValue([
    { id: 'password', enabled: true, label: 'Email et mot de passe' },
    { id: 'pocketid', enabled: true, label: 'PocketID' },
    { id: 'google', enabled: true, label: 'Google' },
  ])
  return connector
}

async function renderWith(ui: React.ReactElement, connector: FakeFridgeConnector) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{ui}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

const footer = <AuthMethodFooter emailLabel="Continuer avec e-mail" emailForm={null} onSuccess={() => {}} />

async function renderAccount() {
  const connector = connectorOfferingGoogle()
  await connector.signInSocial()
  return renderWith(<AccountScreen />, connector)
}

describe('without Google (iOS)', () => {
  beforeEach(() => {
    mockCapabilities.googleSignIn = false
  })

  test('sign-in offers PocketID but not Google', async () => {
    await renderWith(footer, connectorOfferingGoogle())

    await waitFor(() => expect(screen.getByTestId('auth-method-pocketid')).toBeTruthy())
    expect(screen.queryByTestId('auth-method-google')).toBeNull()
  })

  test('account linking does not offer Google', async () => {
    await renderAccount()

    await waitFor(() => expect(screen.getByText('demo@example.com')).toBeTruthy())
    expect(screen.queryByTestId('account-link-google')).toBeNull()
  })
})

describe('with Google (Android, web)', () => {
  beforeEach(() => {
    mockCapabilities.googleSignIn = true
  })

  test('sign-in offers Google', async () => {
    await renderWith(footer, connectorOfferingGoogle())

    await waitFor(() => expect(screen.getByTestId('auth-method-google')).toBeTruthy())
  })

  test('account linking offers Google', async () => {
    await renderAccount()

    await waitFor(() => expect(screen.getByTestId('account-link-google')).toBeTruthy())
  })
})
