import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { RecipeDetailScreen } from './recipe-detail-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
}))

function renderRecipe(recipeId: string, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <RecipeDetailScreen recipeId={recipeId} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

test('shows the recipe with its numbered steps', async () => {
  renderRecipe('fake-recipe-1')

  await waitFor(() => expect(screen.getByText('Poêlée poulet-épinards')).toBeTruthy())
  expect(screen.getByText('Faire revenir le poulet coupé en dés 8 min.')).toBeTruthy()
  expect(screen.getByText('20 min')).toBeTruthy()
})

test('separates what the foyer already owns from what it has to buy', async () => {
  // No AI latency: this test wants the generated recipe's shape, not the wait.
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  // A generated recipe is the case where the backend links ingredients to
  // real products; the seeded fixtures carry none.
  const enqueued = await connector.enqueueRecipeGeneration(undefined)
  if (!enqueued.ok) throw new Error('enqueue failed')
  await waitFor(async () => {
    const jobs = await connector.getJobs()
    expect(jobs.find((j) => j.id === enqueued.value.id)?.status).toBe('succeeded')
  })
  const [generated] = await connector.getRecipes()
  renderRecipe(generated.id, connector)

  await waitFor(() => expect(screen.getByTestId('recipe-owned')).toBeTruthy())
  expect(screen.queryByTestId('recipe-missing')).toBeNull()
  expect(screen.getByText('Tu as tout ce qu’il faut.')).toBeTruthy()
})

test('the split agrees with the count the list card printed, on a recipe the backend never linked', async () => {
  // `fake-recipe-1` carries `productId: null` on all three ingredients — the
  // shape every AI-generated recipe has in production. Splitting on that field
  // put all three under "À prévoir" while the list card said "2 sur 3 chez
  // toi", so the app offered to buy back the spinach it had just said you own.
  const connector = new FakeFridgeConnector()
  renderRecipe('fake-recipe-1', connector)

  await waitFor(() => expect(screen.getByTestId('recipe-owned')).toBeTruthy())
  expect(screen.getByText('Estimé d’après les noms de tes produits.')).toBeTruthy()
  expect(screen.getByTestId('recipe-missing')).toBeTruthy()
})

test('only the ingredients the foyer lacks are pushed onto the shopping list', async () => {
  const connector = new FakeFridgeConnector()
  // The shopping list fixture already names some of these, so the assertion is
  // on what this tap *adds*, not on what the list ends up holding.
  const before = (await connector.getShoppingItems()).length
  renderRecipe('fake-recipe-1', connector)

  await waitFor(() => expect(screen.getByTestId('recipe-owned')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipe-add-missing'))

  await waitFor(async () => {
    const items = await connector.getShoppingItems()
    // One ingredient added — the chicken. The spinach and the rice are in the
    // garde-manger and must not be bought again.
    expect(items.length).toBe(before + 1)
    expect(items[items.length - 1].name).toBe('Filet de poulet')
  })
})

test('a recipe can be dropped from the screen where you decide you are done with it', async () => {
  const connector = new FakeFridgeConnector()
  renderRecipe('fake-recipe-1', connector)

  await waitFor(() => expect(screen.getByTestId('recipe-detail-actions')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipe-detail-actions'))

  // Same sheet, same consequence named, as the list's own entrance.
  await waitFor(() => expect(screen.getByText('Supprimer « Poêlée poulet-épinards » ?')).toBeTruthy())
  expect(screen.getByText('Elle disparaît aussi pour les autres membres du foyer, et c’est définitif.')).toBeTruthy()

  fireEvent.press(screen.getByTestId('recipe-detail-delete-confirm'))

  await waitFor(async () => {
    const remaining = await connector.getRecipes()
    expect(remaining.map((r) => r.id)).not.toContain('fake-recipe-1')
  })
})

test('cooking a recipe takes its products out of the garde-manger and is counted', async () => {
  const connector = new FakeFridgeConnector()
  const before = (await connector.getProducts()).length
  renderRecipe('fake-recipe-1', connector)

  await waitFor(() => expect(screen.getByTestId('recipe-cooked')).toBeTruthy())
  // The button says what it will take, before the sheet is opened.
  expect(screen.getByText('2 produits sortiront du garde-manger')).toBeTruthy()

  fireEvent.press(screen.getByTestId('recipe-cooked'))
  await waitFor(() =>
    expect(screen.getByText('Tu as cuisiné « Poêlée poulet-épinards » ?')).toBeTruthy(),
  )
  fireEvent.press(screen.getByTestId('recipe-cooked-confirm'))

  await waitFor(async () => {
    // The whole point: the épinards and the riz are gone, so the dashboard's
    // expiry counts fall for the right reason and "Ce soir" stops recommending
    // the same dish for the same product tomorrow.
    const products = await connector.getProducts()
    expect(products.length).toBe(before - 2)
    expect(products.map((p) => p.name)).not.toContain('Épinards frais')
  })

  const cooked = await connector.getRecipe('fake-recipe-1')
  expect(cooked?.cookCount).toBe(1)
})

test('the recipe says who put it in the foyer library', async () => {
  renderRecipe('fake-recipe-2')

  // fake-recipe-2 is Camille's and has been made twice — what the foyer did
  // with it outranks who typed it in.
  await waitFor(() => expect(screen.getByText(/Cuisinée 2 fois · Camille/)).toBeTruthy())
})

test('an unknown recipe says so instead of rendering a blank screen', async () => {
  renderRecipe('nope')

  await waitFor(() => expect(screen.getByText('Recette introuvable.')).toBeTruthy())
})
