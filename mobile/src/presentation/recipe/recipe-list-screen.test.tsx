import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { RecipeListScreen } from './recipe-list-screen.js'
import type { Product } from '../../domain/fridge/product.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}))

/** Midnight UTC of a calendar day — the shape every write in the app produces. */
function calendarDayFromToday(offsetDays: number): string {
  const today = new Date()
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays)).toISOString()
}

function productExpiringIn(name: string, days: number | null): Product {
  return {
    id: `product-${name}`,
    name,
    quantity: { amount: 1, unit: 'pièce' },
    location: 'fridge',
    expiresAt: days === null ? null : calendarDayFromToday(days),
    openedAt: null,
    category: 'Test',
    categories: null,
    openfoodfactId: null,
    receiptId: null,
    price: null,
    imageKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * The product fixtures carry fixed calendar dates that are now in the past, so
 * every test that cares about "ce soir" states its own garde-manger — the band
 * is a claim about what is due this week and has to be given something due.
 */
function renderList({ products = [] as Product[] }: { products?: Product[] } = {}) {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getProducts').mockResolvedValue(products)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <RecipeListScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('a recipe opens that recipe instead of a "bientôt disponible" toast', async () => {
  renderList()

  await waitFor(() => expect(screen.getByTestId('recipe-card-fake-recipe-1')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipe-card-fake-recipe-1'))

  expect(router.push).toHaveBeenCalledWith({ pathname: '/(tabs)/recipes/[id]', params: { id: 'fake-recipe-1' } })
})

test('the header action opens the composer rather than firing a request', async () => {
  renderList()

  await waitFor(() => expect(screen.getByTestId('recipes-generate')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate'))

  expect(router.push).toHaveBeenCalledWith('/(tabs)/recipes/generate')
})

test('a recipe states how much of it is already in the garde-manger', async () => {
  renderList({ products: [productExpiringIn('Épinards frais', 2), productExpiringIn('Riz basmati', null)] })

  // "Poêlée poulet-épinards" needs chicken, spinach and rice; the foyer has two of the three.
  await waitFor(() => expect(screen.getByText('2 sur 3 chez toi')).toBeTruthy())
})

test('the shortlist names the product it saves and leads with the most urgent', async () => {
  renderList({ products: [productExpiringIn('Épinards frais', 1)] })

  await waitFor(() => expect(screen.getByText('Ce soir')).toBeTruthy())
  expect(screen.getByTestId('recipe-tonight-fake-recipe-1')).toBeTruthy()
  // The product and its date are one wrapping line on the hero, not two pills:
  // at a phone's width the pills ellipsised the product down to "Épinar…".
  expect(screen.getByText(/Épinards frais · À consommer demain/)).toBeTruthy()
})

test('a second product due puts an alternate beside the hero, and it states its own date', async () => {
  renderList({
    products: [productExpiringIn('Épinards frais', 1), productExpiringIn('Yaourts nature', 3)],
  })

  await waitFor(() => expect(screen.getByTestId('recipe-tonight-fake-recipe-1')).toBeTruthy())
  // The alternate is half of what the band promises and had never been rendered
  // in a test or a capture.
  expect(screen.getByTestId('recipe-tonight-fake-recipe-2')).toBeTruthy()
  // Icon and colour and word: the chip used to carry the glyph, the `soon` tint
  // and the product name, and nothing on it said the product was expiring.
  expect(screen.getByText('À consommer sous 3 j')).toBeTruthy()
})

test('the shortlist cards speak the cooking time and the estimate, like the rows below them', async () => {
  renderList({ products: [productExpiringIn('Épinards frais', 1)] })

  await waitFor(() => expect(screen.getByTestId('recipe-tonight-fake-recipe-1')).toBeTruthy())

  const label = screen.getByTestId('recipe-tonight-fake-recipe-1').props.accessibilityLabel
  expect(label).toContain('20 minutes')
  expect(label).toContain('estimation')
})

test('nothing due this week means no shortlist at all', async () => {
  renderList({ products: [productExpiringIn('Épinards frais', 60)] })

  await waitFor(() => expect(screen.getByTestId('recipe-card-fake-recipe-1')).toBeTruthy())

  expect(screen.queryByText('Ce soir')).toBeNull()
})

test('a long press offers to delete the recipe, and confirming removes it for the foyer', async () => {
  renderList()

  await waitFor(() => expect(screen.getByTestId('recipe-card-fake-recipe-1')).toBeTruthy())

  fireEvent(screen.getByTestId('recipe-card-fake-recipe-1'), 'longPress')

  await waitFor(() => expect(screen.getByTestId('recipe-delete-action')).toBeTruthy())
  fireEvent.press(screen.getByTestId('recipe-delete-action'))
  await waitFor(() => expect(screen.getByText('Supprimer « Poêlée poulet-épinards » ?')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipe-delete-confirm'))

  await waitFor(() => expect(screen.queryByTestId('recipe-card-fake-recipe-1')).toBeNull())
})

test('the visible row control offers the same deletion, without knowing the gesture', async () => {
  renderList()

  await waitFor(() => expect(screen.getByTestId('recipe-actions-fake-recipe-1')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipe-actions-fake-recipe-1'))

  await waitFor(() => expect(screen.getByTestId('recipe-delete-action')).toBeTruthy())
  fireEvent.press(screen.getByTestId('recipe-delete-action'))
  await waitFor(() => expect(screen.getByText('Supprimer « Poêlée poulet-épinards » ?')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipe-delete-confirm'))

  await waitFor(() => expect(screen.queryByTestId('recipe-card-fake-recipe-1')).toBeNull())
})

test('a pantry count on a row is disclosed as an estimate, not stated as a fact', async () => {
  // Nothing due this week, so "Ce soir" and its own disclosure never render —
  // the rows are the only place the count appears.
  renderList({ products: [productExpiringIn('Épinards frais', 60)] })

  await waitFor(() => expect(screen.getByTestId('recipe-card-fake-recipe-1')).toBeTruthy())

  expect(screen.queryByText('Ce soir')).toBeNull()
  expect(screen.getByText('Disponibilité estimée d’après les noms des ingrédients.')).toBeTruthy()
})

test('a time budget narrows the library and can be pressed again to clear itself', async () => {
  renderList()

  await waitFor(() => expect(screen.getByTestId('recipe-card-fake-recipe-3')).toBeTruthy())

  // "Riz sauté aux petits pois" takes 25 minutes; "Yaourts glacés maison" takes 10.
  fireEvent.press(screen.getByTestId('recipes-budget-15'))
  await waitFor(() => expect(screen.queryByTestId('recipe-card-fake-recipe-3')).toBeNull())
  expect(screen.getByTestId('recipe-card-fake-recipe-2')).toBeTruthy()

  fireEvent.press(screen.getByTestId('recipes-budget-15'))
  await waitFor(() => expect(screen.getByTestId('recipe-card-fake-recipe-3')).toBeTruthy())
})

test('the search reaches ingredients, not only titles', async () => {
  renderList()

  await waitFor(() => expect(screen.getByTestId('recipes-search')).toBeTruthy())

  fireEvent.changeText(screen.getByTestId('recipes-search'), 'petits pois')

  await waitFor(() => expect(screen.queryByTestId('recipe-card-fake-recipe-1')).toBeNull())
  expect(screen.getByTestId('recipe-card-fake-recipe-3')).toBeTruthy()
})

test('a failed read says so instead of claiming the foyer has no recipes', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getProducts').mockResolvedValue([])
  jest.spyOn(connector, 'getRecipes').mockRejectedValue(new Error('offline'))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <RecipeListScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('recipes-retry')).toBeTruthy())
  expect(screen.queryByText('Aucune recette pour l’instant')).toBeNull()
})


test('archiving hides a recipe, Archives retrieves it, and restoring puts it back', async () => {
  const connector = renderList()
  await waitFor(() => expect(screen.getByTestId('recipe-actions-fake-recipe-1')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('recipe-actions-fake-recipe-1'))
  await fireEvent.press(screen.getByTestId('recipe-archive-toggle'))
  await waitFor(() => expect(screen.queryByTestId('recipe-card-fake-recipe-1')).toBeNull())
  expect((await connector.getRecipe('fake-recipe-1'))?.isArchived).toBe(true)
  await fireEvent.press(screen.getByTestId('recipes-collection-archived'))
  await waitFor(() => expect(screen.getByTestId('recipe-card-fake-recipe-1')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('recipe-actions-fake-recipe-1'))
  await fireEvent.press(screen.getByTestId('recipe-archive-toggle'))
  await waitFor(() => expect(screen.queryByTestId('recipe-card-fake-recipe-1')).toBeNull())
  await fireEvent.press(screen.getByTestId('recipes-collection-active'))
  await waitFor(() => expect(screen.getByTestId('recipe-card-fake-recipe-1')).toBeTruthy())
  expect((await connector.getRecipe('fake-recipe-1'))?.isArchived).toBe(false)
})

test('favorites are pinned first and can be removed from the Favorites collection', async () => {
  const connector = renderList()
  await waitFor(() => expect(screen.getByTestId('recipe-actions-fake-recipe-2')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('recipe-actions-fake-recipe-2'))
  await fireEvent.press(screen.getByTestId('recipe-favorite-toggle'))
  await waitFor(() => expect(screen.getByText('Favorite · épinglée')).toBeTruthy())
  expect(screen.getAllByTestId(/^recipe-card-/)[0].props.testID).toBe('recipe-card-fake-recipe-2')
  await fireEvent.press(screen.getByTestId('recipes-collection-favorites'))
  expect(screen.queryByTestId('recipe-card-fake-recipe-1')).toBeNull()
  await fireEvent.press(screen.getByTestId('recipe-actions-fake-recipe-2'))
  await fireEvent.press(screen.getByTestId('recipe-favorite-toggle'))
  await waitFor(() => expect(screen.queryByTestId('recipe-card-fake-recipe-2')).toBeNull())
  expect((await connector.getRecipe('fake-recipe-2'))?.isFavorite).toBe(false)
})

test('a failed archive leaves the recipe visible and reports the failure', async () => {
  const connector = renderList()
  jest.spyOn(connector, 'updateRecipeState').mockResolvedValue({ ok: false, error: { type: 'offline', message: 'Offline' } })
  await waitFor(() => expect(screen.getByTestId('recipe-actions-fake-recipe-1')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('recipe-actions-fake-recipe-1'))
  await fireEvent.press(screen.getByTestId('recipe-archive-toggle'))
  await waitFor(() => expect(screen.getByText('Modification impossible. Réessaie depuis le menu de la recette.')).toBeTruthy())
  expect(screen.getByTestId('recipe-card-fake-recipe-1')).toBeTruthy()
})
