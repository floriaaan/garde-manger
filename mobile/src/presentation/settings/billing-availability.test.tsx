/**
 * iOS uses StoreKit; Android/web keep Stripe (#110).
 * The capability is mocked so both sides run whatever platform jest-expo picks.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Linking from 'expo-linking'
import { Linking as NativeLinking } from 'react-native'
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
import type { AppleProduct } from '../../domain/settings/apple-purchases.js'
import type { AiAccess } from '../../domain/settings/ai-settings.js'
import type { PlatformCapabilities } from '../../domain/shared/platform-capabilities.js'

const mockCapabilities: PlatformCapabilities = { billing: true, storeKit: false, googleSignIn: true }
const mockApple = {
  product: { id: 'ai.monthly', displayPrice: '1,49 €', title: 'IA du foyer' } as AppleProduct | null,
  pending: false, error: null as string | null, notice: null as string | null,
  subscribe: jest.fn(async () => {}), restore: jest.fn(async () => {}), manage: jest.fn(async () => {}), retry: jest.fn(),
}
jest.mock('../../application/settings/apple-subscription-context.js', () => ({ useAppleSubscription: () => mockApple }))
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

describe('native StoreKit (iOS)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCapabilities.billing = false
    mockCapabilities.storeKit = true
    mockApple.error = null
    mockApple.product = { id: 'ai.monthly', displayPrice: '1,49 €', title: 'IA du foyer' }
  })

  test('uses the localized App Store product and purchase action, never Stripe', async () => {
    const { checkout, portal } = await renderWith(<SubscriptionScreen />, spentFree)
    await waitFor(() => expect(screen.getByText('1,49 €')).toBeTruthy())
    expect(screen.queryByText('0,99€')).toBeNull()
    expect(screen.queryByText(/Paiement sécurisé par Stripe/)).toBeNull()
    expect(screen.queryByTestId('subscription-withdrawal-notice')).toBeNull()
    expect(screen.queryByTestId('subscription-web-link')).toBeNull()
    await fireEvent.press(screen.getByTestId('subscription-paywall-cta'))
    expect(mockApple.subscribe).toHaveBeenCalledTimes(1)
    expect(checkout).not.toHaveBeenCalled()
    expect(portal).not.toHaveBeenCalled()
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled()
    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  test('an unavailable App Store product cannot fall back to Stripe or a hardcoded price', async () => {
    mockApple.product = null
    const { checkout } = await renderWith(<SubscriptionScreen />, spentFree)
    await waitFor(() => expect(screen.getByTestId('subscription-paywall-cta')).toBeTruthy())
    expect(screen.getByTestId('subscription-paywall-cta')).toBeDisabled()
    expect(screen.queryByText('0,99€')).toBeNull()
    expect(checkout).not.toHaveBeenCalled()
  })

  test('iOS keeps restoration separate from the two legal links and preserves their destinations', async () => {
    const openURL = jest.spyOn(NativeLinking, 'openURL').mockResolvedValue(true)
    await renderWith(<SubscriptionScreen />, spentFree)
    await waitFor(() => expect(screen.getByTestId('subscription-legal-links')).toBeTruthy())
    await fireEvent.press(screen.getByTestId('subscription-restore'))
    expect(mockApple.restore).toHaveBeenCalledTimes(1)
    expect(openURL).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Conditions d’utilisation' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toBeTruthy()
    await fireEvent.press(screen.getByTestId('subscription-terms'))
    expect(openURL).toHaveBeenLastCalledWith('https://gardemanger.floriaaan.fr/cgu')
    await fireEvent.press(screen.getByTestId('subscription-privacy'))
    expect(openURL).toHaveBeenLastCalledWith('https://gardemanger.floriaaan.fr/privacy')
    openURL.mockRestore()
  })

  test('restoration and Apple management use native actions', async () => {
    await renderWith(<SubscriptionScreen />, { ...subscriber, subscriptionProvider: 'apple' })
    await waitFor(() => expect(screen.getByTestId('subscription-active')).toBeTruthy())
    await fireEvent.press(screen.getByTestId('subscription-manage'))
    await fireEvent.press(screen.getByTestId('subscription-restore'))
    expect(mockApple.manage).toHaveBeenCalledTimes(1)
    expect(mockApple.restore).toHaveBeenCalledTimes(1)
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled()
  })

  test('a Stripe entitlement remains active on iOS without a second purchase or external management link', async () => {
    await renderWith(<SubscriptionScreen />, { ...subscriber, subscriptionProvider: 'stripe' })
    await waitFor(() => expect(screen.getByTestId('subscription-active')).toBeTruthy())
    expect(screen.queryByTestId('subscription-paywall')).toBeNull()
    expect(screen.queryByTestId('subscription-manage')).toBeNull()
    expect(screen.queryByTestId('subscription-web-link')).toBeNull()
  })

  test('Réglages lists Abonnement and the quota can point to the native offer', async () => {
    await renderWith(<SettingsScreen />, spentFree)
    await waitFor(() => expect(screen.getByTestId('settings-subscription')).toBeTruthy())
    await fireEvent.press(screen.getByTestId('settings-subscription'))
    expect(router.push).toHaveBeenCalledWith('/subscription')
  })

  test('self-hosted instances have no purchase offer', async () => {
    await renderWith(<SubscriptionScreen />, { plan: 'self-hosted', used: 0, limit: null, resetsAt: null, expiresAt: null })
    await waitFor(() => expect(screen.getByTestId('subscription-not-applicable')).toBeTruthy())
    expect(screen.queryByTestId('subscription-paywall')).toBeNull()
    expect(screen.queryByTestId('subscription-restore')).toBeNull()
  })
})

describe('with billing (Android, web)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCapabilities.billing = true
    mockCapabilities.storeKit = false
  })

  test('a spent free quota shows the paywall', async () => {
    await renderWith(<SubscriptionScreen />, spentFree)

    await waitFor(() => expect(screen.getByTestId('subscription-paywall')).toBeTruthy())
    expect(screen.getByText('0,99€')).toBeTruthy()
    expect(screen.getByText(/Paiement sécurisé par Stripe/)).toBeTruthy()
    expect(screen.getByText('Voir les CGV')).toBeTruthy()
    expect(screen.getByTestId('subscription-withdrawal-notice')).toBeTruthy()
    expect(screen.getByTestId('subscription-paywall-cta')).toBeTruthy()
    expect(screen.queryByTestId('subscription-web-link')).toBeNull()
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
