import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { AiProviderScreen } from './ai-provider-screen.js'
import type { AiSettings } from '../../domain/settings/ai-settings.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

function selfHostedSettings(overrides: Partial<AiSettings> = {}): AiSettings {
  return {
    activeProvider: 'gemini',
    source: 'environment',
    availableProviders: ['gemini', 'openai'],
    canChooseProvider: true,
    models: { vision: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
    access: { plan: 'self-hosted', used: 0, limit: null, resetsAt: null, expiresAt: null },
    ...overrides,
  }
}

async function renderScreen(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <AiProviderScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('shows only the available providers with the active one selected, and says what the choice drives', async () => {
  await renderScreen()

  await waitFor(() => expect(screen.getByTestId('ai-provider-gemini')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-ollama')).toBeNull()
  expect(screen.getByTestId('ai-provider-gemini').props.accessibilityState.selected).toBe(true)
  expect(screen.getByText('Lit tes tickets de caisse et invente tes recettes.')).toBeTruthy()
})

test('a single available provider is stated, not offered as a choice of one', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getAiSettings').mockResolvedValue(selfHostedSettings({ availableProviders: ['gemini'] }))

  await renderScreen(connector)

  await waitFor(() => expect(screen.getByTestId('settings-ai-models')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-gemini')).toBeNull()
})

test('a self-hosted server with no provider configured points at the setup guide', async () => {
  const connector = new FakeFridgeConnector()
  jest
    .spyOn(connector, 'getAiSettings')
    .mockResolvedValue(selfHostedSettings({ availableProviders: [], models: { vision: '', text: '' } }))

  await renderScreen(connector)

  await waitFor(() => expect(screen.getByTestId('ai-setup-guide-link')).toBeTruthy())
})

test('tapping an unselected provider switches the active one', async () => {
  await renderScreen()

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('ai-provider-openai'))

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai').props.accessibilityState.selected).toBe(true))
})

test('the hosted instance never offers a provider choice', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getAiSettings').mockResolvedValue(
    selfHostedSettings({
      canChooseProvider: false,
      access: { plan: 'subscriber', used: 12, limit: 150, resetsAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-18T00:00:00Z' },
    }),
  )

  await renderScreen(connector)

  await waitFor(() => expect(screen.getByTestId('ai-provider-official')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-gemini')).toBeNull()
  expect(screen.queryByTestId('subscription-paywall')).toBeNull()
  expect(screen.getByTestId('ai-quota-hint')).toBeTruthy()
})

test('a non-subscriber on the hosted instance sees their quota, the paywall lives in Abonnement', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getAiSettings').mockResolvedValue(
    selfHostedSettings({
      canChooseProvider: false,
      access: { plan: 'free', used: 5, limit: 5, resetsAt: '2026-10-01T00:00:00Z', expiresAt: null },
    }),
  )

  await renderScreen(connector)

  await waitFor(() => expect(screen.getByTestId('ai-quota-hint')).toBeTruthy())
  expect(screen.queryByTestId('subscription-paywall')).toBeNull()
})
