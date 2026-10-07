import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { HouseholdDashboard } from './household-dashboard.js'
import { Platform } from 'react-native'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() }, useFocusEffect: jest.fn() }))
// iOS cannot bill directly, but the household's subscription still applies.
jest.mock('../../application/shared/platform-capabilities.js', () => ({
  platformCapabilities: { billing: false, googleSignIn: false },
}))

// The fake fridge holds one product whose date is already in the past (milk,
// 2026-08-30), one long-life frozen bag and one undated bag of rice — so the
// expected counts hold on any date after that, no clock stubbing needed.
const noop = () => {}

function renderDashboard(overrides: Partial<React.ComponentProps<typeof HouseholdDashboard>> = {}, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <HouseholdDashboard
            userName="Demo"
            onOpenRecettes={noop}
            onOpenCourses={noop}
            onOpenFridge={noop}
            onOpenProduct={noop}
            onAddProduct={noop}
            onOpenStats={noop}
            onOpenSettings={noop}
            onOpenTasks={noop}
            onOpenReceipts={noop}
            onOpenHousehold={noop}
            {...overrides}
          />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

test.each(['subscriber', 'free', 'self-hosted'] as const)('the header mascot follows the %s plan even without direct billing', async (plan) => {
  const connector = new FakeFridgeConnector()
  const settings = await connector.getAiSettings()
  jest.spyOn(connector, 'getAiSettings').mockResolvedValue({ ...settings!, access: { ...settings!.access, plan } })
  renderDashboard({}, connector)

  await waitFor(() => expect(screen.getByText('Appartement des loulous')).toBeTruthy())
  if (plan === 'subscriber') {
    await waitFor(() => expect(screen.getByTestId('dashboard-subscriber-badge')).toBeTruthy())
    expect(screen.getByLabelText('Abonnement actif').props.source).toEqual(require('../../../assets/mascot-gold.png'))
    expect(screen.queryByTestId('dashboard-mascot')).toBeNull()
  } else {
    expect(screen.getByTestId('dashboard-mascot').props.source).toEqual(require('../../../assets/mascot.png'))
    expect(screen.queryByTestId('dashboard-subscriber-badge')).toBeNull()
  }
})

test.each(['free', 'self-hosted'] as const)('the %s dashboard places the review card after its content', async (plan) => {
  const originalPlatform = Platform.OS
  Platform.OS = 'ios'
  try {
    const connector = new FakeFridgeConnector()
    const settings = await connector.getAiSettings()
    jest.spyOn(connector, 'getAiSettings').mockResolvedValue({ ...settings!, access: { ...settings!.access, plan } })
    renderDashboard({}, connector)
    await waitFor(() => expect(screen.getByText('Appartement des loulous')).toBeTruthy())
    expect(screen.getByTestId('dashboard-store-review-card')).toBeTruthy()
    const tree = JSON.stringify(screen.toJSON())
    expect(tree.indexOf('dashboard-store-review-card')).toBeGreaterThan(tree.indexOf('dashboard-receipts'))
  } finally {
    Platform.OS = originalPlatform
  }
})

test('names the real household, not a hardcoded one', async () => {
  renderDashboard()

  await waitFor(() => expect(screen.getByText('Appartement des loulous')).toBeTruthy())
})

test('the hero counts the products actually at risk in the fridge', async () => {
  renderDashboard()

  await waitFor(() => expect(screen.getByText('5 produits à cuisiner en premier')).toBeTruthy())
  expect(screen.getByText('1 dépassé')).toBeTruthy()
})

test('"À racheter" counts the unchecked shopping items, and counts them once', async () => {
  renderDashboard()

  // Four of the five fake items are unchecked. The count lives on the stat
  // card; the Courses NavCard used to repeat it 200pt below with the same
  // destination, so the number now appears exactly once on the screen.
  await waitFor(() => expect(screen.getByLabelText('À racheter, 4 articles')).toBeTruthy())
  expect(screen.queryByText('4 articles à prendre')).toBeNull()
})

test('the hero is the sum of the two cards beneath it', async () => {
  renderDashboard()

  // The fake fridge holds one product whose date has passed (the ham), four due
  // inside the week and one staple with no date — so "cette semaine" is 4,
  // "dépassées" is 1, and the hero must say 5. It used to count its own −∞…3
  // window instead.
  await waitFor(() => expect(screen.getByText('5 produits à cuisiner en premier')).toBeTruthy())
  expect(screen.getByLabelText('Dates dépassées, 1 produit')).toBeTruthy()
  expect(screen.getByLabelText('Cette semaine, 4 produits')).toBeTruthy()
})

test('a product in the preview opens that product', async () => {
  const onOpenProduct = jest.fn()
  renderDashboard({ onOpenProduct })

  await waitFor(() => expect(screen.getByTestId('dashboard-product-fake-product-1')).toBeTruthy())

  fireEvent.press(screen.getByTestId('dashboard-product-fake-product-1'))

  expect(onOpenProduct).toHaveBeenCalledWith('fake-product-1')
})

test('an empty fridge offers the two ways to fill it instead of a dead sentence', async () => {
  const onAddProduct = jest.fn()
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getProducts').mockResolvedValue([])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <HouseholdDashboard
            userName="Demo"
            onOpenRecettes={noop}
            onOpenCourses={noop}
            onOpenFridge={noop}
            onOpenProduct={noop}
            onAddProduct={onAddProduct}
            onOpenStats={noop}
            onOpenSettings={noop}
            onOpenTasks={noop}
            onOpenReceipts={noop}
            onOpenHousehold={noop}
          />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByText('Ton garde-manger est encore vide')).toBeTruthy())

  fireEvent.press(screen.getByTestId('dashboard-empty-add'))

  expect(onAddProduct).toHaveBeenCalled()
})

test('the "Cette semaine" card opens the garde-manger on that week, not on everything', async () => {
  const onOpenFridge = jest.fn()
  renderDashboard({ onOpenFridge })

  await waitFor(() => expect(screen.getByTestId('dashboard-stat-week')).toBeTruthy())

  fireEvent.press(screen.getByTestId('dashboard-stat-week'))

  expect(onOpenFridge).toHaveBeenCalledWith('week')
})

test('the "Dates dépassées" card opens the garde-manger on what is already lost', async () => {
  const onOpenFridge = jest.fn()
  renderDashboard({ onOpenFridge })

  await waitFor(() => expect(screen.getByTestId('dashboard-stat-expired')).toBeTruthy())

  fireEvent.press(screen.getByTestId('dashboard-stat-expired'))

  expect(onOpenFridge).toHaveBeenCalledWith('expired')
})

test('the "À racheter" card opens the shopping list', async () => {
  const onOpenCourses = jest.fn()
  renderDashboard({ onOpenCourses })

  await waitFor(() => expect(screen.getByTestId('dashboard-stat-to-buy')).toBeTruthy())

  fireEvent.press(screen.getByTestId('dashboard-stat-to-buy'))

  expect(onOpenCourses).toHaveBeenCalled()
})

test('receipts are reachable from the dashboard, and the row says what is behind it', async () => {
  const onOpenReceipts = jest.fn()
  renderDashboard({ onOpenReceipts })

  await waitFor(() => expect(screen.getByText('Tickets de caisse')).toBeTruthy())
  expect(screen.getByText('1 ticket · dernier : Carrefour')).toBeTruthy()

  fireEvent.press(screen.getByTestId('dashboard-receipts'))

  expect(onOpenReceipts).toHaveBeenCalled()
})

test('the receipts row announces what is behind it, not just its title', async () => {
  renderDashboard()

  await waitFor(() => expect(screen.getByText('Tickets de caisse')).toBeTruthy())

  expect(screen.getByLabelText('Tickets de caisse. 1 ticket · dernier : Carrefour')).toBeTruthy()
})

test('a stat card that shows a dash does not announce a number', async () => {
  const connector = new FakeFridgeConnector()
  let release: (value: never[]) => void = () => {}
  jest.spyOn(connector, 'getProducts').mockReturnValue(new Promise((resolve) => { release = resolve }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <HouseholdDashboard
            userName="Demo"
            onOpenRecettes={noop}
            onOpenCourses={noop}
            onOpenFridge={noop}
            onOpenProduct={noop}
            onAddProduct={noop}
            onOpenStats={noop}
            onOpenSettings={noop}
            onOpenTasks={noop}
            onOpenReceipts={noop}
            onOpenHousehold={noop}
          />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  // The card renders `—` while loading; the label used to interpolate the raw
  // count anyway, so a screen reader heard a confident "0 produit" over an
  // honest blank.
  await waitFor(() => expect(screen.getByLabelText('Cette semaine, chargement')).toBeTruthy())
  release([])
})

test('the foyer is on the foyer\'s home screen — its members, and the way in', async () => {
  const onOpenHousehold = jest.fn()
  renderDashboard({ onOpenHousehold })

  await waitFor(() => expect(screen.getByText('Appartement des loulous')).toBeTruthy())

  // Two fixture members: overlapping avatars, next to the name, on the one
  // screen everybody opens.
  expect(screen.getByLabelText('Avatar de Thomas C.')).toBeTruthy()
  expect(screen.getByLabelText('Avatar de Camille')).toBeTruthy()

  fireEvent.press(screen.getByTestId('dashboard-household'))

  expect(onOpenHousehold).toHaveBeenCalled()
})
