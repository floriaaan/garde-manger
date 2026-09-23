/**
 * ADR 0019: where the platform has no billing (iOS, App Store 3.1.1), no
 * screen names the subscription, a price, or a way to pay elsewhere. The
 * capability is mocked so both sides run whatever platform jest-expo picks.
 */
import { render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { SubscriptionScreen } from './subscription-screen.js'
import { SettingsScreen } from './settings-screen.js'
import { AiQuotaHint } from './ai-access-cards.js'
import { failureMessage } from '../job/job-labels.js'
import { makeJob } from '../job/test-utils.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { AiAccess } from '../../domain/settings/ai-settings.js'
import type { PlatformCapabilities } from '../../domain/shared/platform-capabilities.js'

const mockCapabilities: PlatformCapabilities = { billing: true, googleSignIn: true }
// A getter: the factory runs during the imports above, before `mockCapabilities` is initialised.
jest.mock('../../application/shared/platform-capabilities.js', () => ({
  get platformCapabilities() {
    return mockCapabilities
  },
}))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

const spentFree: AiAccess = { plan: 'free', used: 5, limit: 5, resetsAt: '2026-10-01T00:00:00Z', expiresAt: null }
const subscriber: AiAccess = { plan: 'subscriber', used: 3, limit: 150, resetsAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-18T00:00:00Z' }

async function renderWith(ui: React.ReactElement, access: AiAccess) {
  const connector = new FakeFridgeConnector()
  await connector.signInSocial()
  const settings = await connector.getAiSettings()
  jest.spyOn(connector, 'getAiSettings').mockResolvedValue({ ...settings!, canChooseProvider: false, access })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{ui}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

async function renderHint(access: AiAccess) {
  return render(
    <ThemeProvider>
      <AiQuotaHintHost access={access} />
    </ThemeProvider>,
  )
}

function AiQuotaHintHost({ access }: { access: AiAccess }) {
  return <AiQuotaHint access={access} palette={useSoftPalette()} />
}

const quotaJob = makeJob({ status: 'failed', error: { type: 'ai_quota_exceeded', message: 'x' } })

describe('without billing (iOS)', () => {
  beforeEach(() => {
    mockCapabilities.billing = false
  })

  test('a spent free quota shows no paywall and no price on the Abonnement route', async () => {
    await renderWith(<SubscriptionScreen />, spentFree)

    await waitFor(() => expect(screen.getByTestId('ai-quota-hint')).toBeTruthy())
    expect(screen.queryByTestId('subscription-paywall')).toBeNull()
    expect(screen.queryByText(/€/)).toBeNull()
    expect(screen.queryByText(/abonn/i)).toBeNull()
  })

  test('a subscriber from another platform gets no Customer Portal button', async () => {
    await renderWith(<SubscriptionScreen />, subscriber)

    await waitFor(() => expect(screen.getByTestId('ai-quota-hint')).toBeTruthy())
    expect(screen.queryByTestId('subscription-active')).toBeNull()
    expect(screen.queryByTestId('subscription-manage')).toBeNull()
  })

  test('Réglages has no Abonnement entry', async () => {
    await renderWith(<SettingsScreen />, spentFree)

    await waitFor(() => expect(screen.getByText('Thomas')).toBeTruthy())
    expect(screen.queryByTestId('settings-subscription')).toBeNull()
  })

  test('the quota hint neither names a plan nor links to one', async () => {
    await renderHint(spentFree)

    expect(screen.queryByTestId('ai-quota-subscribe')).toBeNull()
    expect(screen.queryByText('Offre gratuite')).toBeNull()
    expect(screen.getByText(/Quota atteint/)).toBeTruthy()
  })

  test('a job stopped by the quota says so, without pushing to pay', () => {
    expect(failureMessage(quotaJob)).toBe('Quota du mois atteint. Il se renouvelle le 1er du mois.')
  })
})

describe('with billing (Android, web)', () => {
  beforeEach(() => {
    mockCapabilities.billing = true
  })

  test('a spent free quota shows the paywall', async () => {
    await renderWith(<SubscriptionScreen />, spentFree)

    await waitFor(() => expect(screen.getByTestId('subscription-paywall')).toBeTruthy())
  })

  test('Réglages lists Abonnement', async () => {
    await renderWith(<SettingsScreen />, spentFree)

    await waitFor(() => expect(screen.getByTestId('settings-subscription')).toBeTruthy())
  })

  test('the quota hint links to the subscription', async () => {
    await renderHint(spentFree)

    expect(screen.getByTestId('ai-quota-subscribe')).toBeTruthy()
  })

  test('a job stopped by the quota points at the offer', () => {
    expect(failureMessage(quotaJob)).toContain('offre IA')
  })
})
