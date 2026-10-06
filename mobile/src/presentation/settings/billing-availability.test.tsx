/**
 * iOS exposes the subscription page but delegates billing to the web (#59).
 * The capability is mocked so both sides run whatever platform jest-expo picks.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { router } from 'expo-router'
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
jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => true), createURL: jest.fn(() => 'gardemanger://subscription') }))
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })) }))
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
  const checkout = jest.spyOn(connector, 'startSubscriptionCheckout')
  const portal = jest.spyOn(connector, 'openBillingPortal')
  const rendered = await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{ui}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { ...rendered, checkout, portal }
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
    jest.clearAllMocks()
    mockCapabilities.billing = false
  })

  test('a spent free quota shows no paywall and no price, only the web action', async () => {
    await renderWith(<SubscriptionScreen />, spentFree)

    await waitFor(() => expect(screen.getByTestId('ai-quota-hint')).toBeTruthy())
    expect(screen.queryByTestId('subscription-paywall')).toBeNull()
    expect(screen.queryByText(/€/)).toBeNull()
    expect(screen.getByTestId('subscription-web-link')).toBeTruthy()
  })

  test('a subscriber from another platform gets no Customer Portal button, only the web link', async () => {
    await renderWith(<SubscriptionScreen />, subscriber)

    await waitFor(() => expect(screen.getByTestId('ai-quota-hint')).toBeTruthy())
    expect(screen.queryByTestId('subscription-active')).toBeNull()
    expect(screen.queryByTestId('subscription-manage')).toBeNull()
    expect(screen.getByTestId('subscription-web-link')).toBeTruthy()
  })

  test('a cancelled subscription shows the remaining access before linking to the web', async () => {
    await renderWith(<SubscriptionScreen />, { ...subscriber, cancelsAtPeriodEnd: true })
    await waitFor(() => expect(screen.getByText('Abonnement résilié')).toBeTruthy())
    expect(screen.getByText(/L’IA reste débloquée jusqu’au/)).toBeTruthy()
    expect(screen.queryByText('Abonnement actif')).toBeNull()
    expect(screen.getByTestId('subscription-web-link')).toBeTruthy()
  })

  test('Réglages opens the subscription page on iOS', async () => {
    await renderWith(<SettingsScreen />, spentFree)

    await waitFor(() => expect(screen.getByText('Thomas')).toBeTruthy())
    const entry = screen.getByTestId('settings-subscription')
    await fireEvent.press(entry)
    expect(router.push).toHaveBeenCalledWith('/subscription')
  })

  test.each([
    ['subscribe', spentFree, 'Souscrire sur le web'],
    ['manage', subscriber, 'Gérer l’abonnement sur le web'],
  ] as const)('%s opens the web subscription route without calling Stripe', async (_action, access, label) => {
    const { checkout, portal } = await renderWith(<SubscriptionScreen />, access)
    await waitFor(() => expect(screen.getByTestId('subscription-web-link')).toBeTruthy())
    expect(screen.getByTestId('subscription-web-link')).toHaveTextContent(label)

    await fireEvent.press(screen.getByTestId('subscription-web-link'))

    expect(Linking.openURL).toHaveBeenCalledWith('https://app.gardemander.floriaaan.fr/subscription')
    expect(checkout).not.toHaveBeenCalled()
    expect(portal).not.toHaveBeenCalled()
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled()
  })

  test('a failed web opening displays an error and lets the user retry', async () => {
    jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('Browser unavailable'))
    const { checkout, portal } = await renderWith(<SubscriptionScreen />, spentFree)
    await waitFor(() => expect(screen.getByTestId('subscription-web-link')).toBeTruthy())

    await fireEvent.press(screen.getByTestId('subscription-web-link'))
    await waitFor(() => expect(screen.getByText('Impossible d’ouvrir l’abonnement sur le web. Réessaie.')).toBeTruthy())
    expect(screen.getByTestId('subscription-web-link').props.disabled).toBe(false)
    await fireEvent.press(screen.getByTestId('subscription-web-link'))
    await waitFor(() => expect(screen.queryByText('Impossible d’ouvrir l’abonnement sur le web. Réessaie.')).toBeNull())
    expect(checkout).not.toHaveBeenCalled()
    expect(portal).not.toHaveBeenCalled()
  })

  test('self-hosted instances have no billing action or settings entry', async () => {
    const access: AiAccess = { plan: 'self-hosted', used: 0, limit: null, resetsAt: null, expiresAt: null }
    const subscriptionView = await renderWith(<SubscriptionScreen />, access)
    await waitFor(() => expect(screen.getByTestId('subscription-not-applicable')).toBeTruthy())
    expect(screen.queryByTestId('subscription-web-link')).toBeNull()
    await subscriptionView.unmount()
    await renderWith(<SettingsScreen />, access)
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
    jest.clearAllMocks()
    mockCapabilities.billing = true
  })

  test('a spent free quota shows the paywall', async () => {
    await renderWith(<SubscriptionScreen />, spentFree)

    await waitFor(() => expect(screen.getByTestId('subscription-paywall')).toBeTruthy())
  })

  test.each([
    ['subscribe', spentFree, 'subscription-paywall-cta', 'https://checkout.stripe.com/fake'],
    ['manage', subscriber, 'subscription-manage', 'https://billing.stripe.com/fake'],
  ] as const)('%s keeps the direct billing flow', async (action, access, testId, url) => {
    const { checkout, portal } = await renderWith(<SubscriptionScreen />, access)
    await waitFor(() => expect(screen.getByTestId(testId)).toBeTruthy())
    await fireEvent.press(screen.getByTestId(testId))
    await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(url, 'gardemanger://subscription'))
    expect(action === 'subscribe' ? checkout : portal).toHaveBeenCalledTimes(1)
    expect(Linking.openURL).not.toHaveBeenCalled()
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
