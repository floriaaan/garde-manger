import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import type { Job } from '../../domain/job/job.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { RecipeGenerateScreen } from './recipe-generate-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn() },
  useFocusEffect: jest.fn(),
}))

// `aiLatencyMs: 0` throughout: this suite tests the composer's wiring, not
// the fake's simulated thinking time — which is long enough to outlast
// `waitFor`'s default timeout for any test that lets the call through.
function renderComposer(connector = new FakeFridgeConnector({ aiLatencyMs: 0 })) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <RecipeGenerateScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    kind: 'recipe_generation',
    status: 'queued',
    progress: { total: 1, done: 0, failed: [] },
    result: null,
    error: null,
    createdAt: '2026-09-20T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    dismissedAt: null,
    ...overrides,
  }
}

/** Pins what the enqueue answers and what the jobs poll returns, so a test decides the job's outcome. */
function stubJob(connector: FakeFridgeConnector, stub: Job) {
  jest.spyOn(connector, 'enqueueRecipeGeneration').mockResolvedValue({ ok: true, value: stub })
  jest.spyOn(connector, 'getJobs').mockResolvedValue([stub])
}

const failedJob = (type: string, message: string) =>
  job({ status: 'failed', error: { type, message }, finishedAt: '2026-09-20T10:00:05.000Z' })

beforeEach(() => {
  jest.clearAllMocks()
})

/**
 * The six chip groups are folded behind "Affiner" (the composer opens as a
 * shortcut, not a form), so any test that reaches an option chip opens it
 * first. This is the one line those tests share.
 */
async function openRefine() {
  await waitFor(() => expect(screen.getByTestId('recipes-refine')).toBeTruthy())
  fireEvent.press(screen.getByTestId('recipes-refine'))
  await waitFor(() => expect(screen.getByTestId('recipes-option-temps-express')).toBeTruthy())
}


test('nothing on the sheet is mandatory — submitting untouched sends no prompt', async () => {
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  const generate = jest.spyOn(connector, 'enqueueRecipeGeneration')
  renderComposer(connector)

  await waitFor(() => expect(screen.getByTestId('recipes-generate-submit')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate-submit'))

  await waitFor(() => expect(generate).toHaveBeenCalledWith(undefined))
})

test('the choices reach the endpoint as one composed prompt, and the sheet closes onto the recipe', async () => {
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  const generate = jest.spyOn(connector, 'enqueueRecipeGeneration')
  renderComposer(connector)

  await openRefine()

  await waitFor(() => expect(screen.getByTestId('recipes-wish')).toBeTruthy())

  // Each step is awaited: this suite's jest environment does not set
  // `IS_REACT_ACT_ENVIRONMENT`, so a render triggered by `fireEvent` is not
  // flushed before the next line reads the tree.
  fireEvent.changeText(screen.getByTestId('recipes-wish'), 'un gratin')
  await waitFor(() => expect(screen.getByTestId('recipes-wish').props.value).toBe('un gratin'))

  fireEvent.press(screen.getByTestId('recipes-option-materiel-sans-four'))
  await waitFor(() =>
    expect(screen.getByTestId('recipes-option-materiel-sans-four').props.accessibilityState).toEqual({ selected: true }),
  )

  fireEvent.press(screen.getByTestId('recipes-option-portions-4'))
  await waitFor(() =>
    expect(screen.getByTestId('recipes-option-portions-4').props.accessibilityState).toEqual({ selected: true }),
  )

  fireEvent.press(screen.getByTestId('recipes-generate-submit'))

  await waitFor(() => expect(generate).toHaveBeenCalledWith('un gratin — sans four, pour 4 personnes.'))
  await waitFor(() => expect(router.dismiss).toHaveBeenCalled())
  expect(router.push).toHaveBeenCalledWith({ pathname: '/(tabs)/recipes/[id]', params: { id: 'fake-recipe-generated-1' } })
})

test('a single-choice group swaps instead of stacking', async () => {
  renderComposer()

  await openRefine()

  await waitFor(() => expect(screen.getByTestId('recipes-option-portions-2')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-option-portions-2'))
  await waitFor(() =>
    expect(screen.getByTestId('recipes-option-portions-2').props.accessibilityState).toEqual({ selected: true }),
  )

  fireEvent.press(screen.getByTestId('recipes-option-portions-6'))
  await waitFor(() =>
    expect(screen.getByTestId('recipes-option-portions-2').props.accessibilityState).toEqual({ selected: false }),
  )
})

test('the seconds-long job gets a real loader, not a quiet button', async () => {
  const connector = new FakeFridgeConnector()
  stubJob(connector, job({ status: 'running', startedAt: '2026-09-20T10:00:01.000Z' }))
  renderComposer(connector)

  await waitFor(() => expect(screen.getByTestId('recipes-generate-submit')).toBeTruthy())
  expect(screen.queryByTestId('recipes-generating')).toBeNull()

  fireEvent.press(screen.getByTestId('recipes-generate-submit'))

  await waitFor(() => expect(screen.getByTestId('recipes-generating')).toBeTruthy())
  expect(screen.getByText('On écrit ta recette')).toBeTruthy()
  // The app's own loading bar, in the palette's chip colours — not the OS spinner.
  expect(screen.getByTestId('recipes-generating-bar')).toBeTruthy()
  // The member is never trapped: the job runs on the server, so they can leave.
  fireEvent.press(screen.getByTestId('recipes-generating-later'))
  expect(router.dismiss).toHaveBeenCalled()
  // The form is unmounted, not covered: nothing left for a screen reader to swipe into.
  expect(screen.queryByTestId('recipes-generate-submit')).toBeNull()
})

test('a generation that has nothing to cook from says why, and the reason stays on screen', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getProducts').mockResolvedValue([])
  stubJob(connector, failedJob('no_products', 'Ajoute des produits au garde-manger pour générer une recette.'))
  renderComposer(connector)

  await waitFor(() => expect(screen.getByTestId('recipes-generate-submit')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate-submit'))

  await waitFor(() => expect(screen.getByTestId('recipes-generate-error')).toBeTruthy())
  expect(screen.getByText('Ajoute des produits au garde-manger pour générer une recette.')).toBeTruthy()
  expect(router.dismiss).not.toHaveBeenCalled()
})

test('the sheet can be closed without generating anything', async () => {
  renderComposer()

  await waitFor(() => expect(screen.getByTestId('recipes-generate-close')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate-close'))

  expect(router.dismiss).toHaveBeenCalled()
})

test('a successful call that produced no recipe says so instead of closing in silence', async () => {
  const connector = new FakeFridgeConnector()
  stubJob(connector, job({ status: 'succeeded', result: { recipeIds: [] }, finishedAt: '2026-09-20T10:00:05.000Z' }))
  renderComposer(connector)

  await waitFor(() => expect(screen.getByTestId('recipes-generate-submit')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate-submit'))

  await waitFor(() => expect(screen.getByTestId('recipes-generate-error')).toBeTruthy())
  expect(screen.getByText(/Aucune recette n’est sortie/)).toBeTruthy()
  // The sheet stays open and the list is not invalidated — it gained nothing.
  expect(router.dismiss).not.toHaveBeenCalled()
  expect(router.push).not.toHaveBeenCalled()
})

test('an empty garde-manger offers the door, before the wait and after it', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getProducts').mockResolvedValue([])
  stubJob(connector, failedJob('no_products', 'Ajoute des produits au garde-manger pour générer une recette.'))
  renderComposer(connector)

  // Before: the empty state carries the action, not just the diagnosis.
  await waitFor(() => expect(screen.getByTestId('recipes-empty-add-product')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate-submit'))

  // After: so does the error, because this modal draws no nav to reach it with.
  await waitFor(() => expect(screen.getByTestId('recipes-error-add-product')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-error-add-product'))

  expect(router.dismiss).toHaveBeenCalled()
  expect(router.push).toHaveBeenCalledWith('/(tabs)/fridge/new')
})

test('a failure the user can only retry offers exactly that', async () => {
  const connector = new FakeFridgeConnector()
  stubJob(connector, failedJob('network_error', 'Serveur injoignable.'))
  renderComposer(connector)

  await waitFor(() => expect(screen.getByTestId('recipes-generate-submit')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate-submit'))

  await waitFor(() => expect(screen.getByTestId('recipes-error-retry')).toBeTruthy())
  expect(screen.queryByTestId('recipes-error-add-product')).toBeNull()
})

test('every chip announces the group it belongs to, not just its own word', async () => {
  renderComposer()

  await openRefine()

  await waitFor(() => expect(screen.getByTestId('recipes-option-temps-express')).toBeTruthy())

  // Drawn "15 min"; announced with its group, so a screen reader does not hear
  // 24 anonymous buttons in one run.
  expect(screen.getByTestId('recipes-option-temps-express').props.accessibilityLabel).toBe('Temps en cuisine : 15 min')
  expect(screen.getByText('15 min')).toBeTruthy()
})

test('a pantry chip is a control, not a caption — tapping it builds the recipe around that product', async () => {
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  const generate = jest.spyOn(connector, 'enqueueRecipeGeneration')
  renderComposer(connector)

  const chips = await waitFor(() => screen.getAllByTestId(/^recipes-pin-/))
  const firstChip = chips[0]!
  expect(firstChip.props.accessibilityState).toMatchObject({ selected: false })

  fireEvent.press(firstChip)
  await waitFor(() =>
    expect(screen.getAllByTestId(/^recipes-pin-/)[0]!.props.accessibilityState).toMatchObject({ selected: true }),
  )

  fireEvent.press(screen.getByTestId('recipes-generate-submit'))

  await waitFor(() => expect(generate).toHaveBeenCalledWith(expect.stringContaining('en utilisant ')))
})

test('the pantry search narrows the chips to the typed name, not just the nearest few', async () => {
  renderComposer()

  await waitFor(() => expect(screen.getByTestId('recipes-pin-fake-product-1')).toBeTruthy())
  expect(screen.getByTestId('recipes-pin-fake-product-3')).toBeTruthy()

  fireEvent.changeText(screen.getByTestId('recipes-pantry-search'), 'basmati')

  await waitFor(() => {
    expect(screen.getByTestId('recipes-pin-fake-product-3')).toBeTruthy()
    expect(screen.queryByTestId('recipes-pin-fake-product-1')).toBeNull()
  })
})

test('a pantry search with no match says so instead of showing an empty card', async () => {
  renderComposer()

  await waitFor(() => expect(screen.getByTestId('recipes-pantry-search')).toBeTruthy())
  fireEvent.changeText(screen.getByTestId('recipes-pantry-search'), 'saucisson')

  await waitFor(() => expect(screen.getByText('Aucun produit ne correspond à « saucisson ».')).toBeTruthy())
})

test('the portions chip that matches the foyer says so, instead of making them count', async () => {
  renderComposer()

  await openRefine()

  // The fake household has two members.
  await waitFor(() => expect(screen.getByText('Pour 2 · ton foyer')).toBeTruthy())
  expect(screen.getByText('Pour 4')).toBeTruthy()
})

test('discarding a filled sheet is confirmed, not done on one tap of a grey link', async () => {
  renderComposer()

  await openRefine()

  await waitFor(() => expect(screen.getByTestId('recipes-option-portions-4')).toBeTruthy())
  fireEvent.press(screen.getByTestId('recipes-option-portions-4'))
  await waitFor(() => expect(screen.getByTestId('recipes-wish-reset')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-wish-reset'))

  await waitFor(() => expect(screen.getByText('Effacer cette envie ?')).toBeTruthy())
  // Still set — the sheet decides, the link does not.
  expect(screen.getByTestId('recipes-option-portions-4').props.accessibilityState).toEqual({ selected: true })

  fireEvent.press(screen.getByTestId('recipes-discard-confirm'))

  await waitFor(() =>
    expect(screen.getByTestId('recipes-option-portions-4').props.accessibilityState).toEqual({ selected: false }),
  )
})

test('closing an untouched sheet does not stop to ask', async () => {
  renderComposer()

  await waitFor(() => expect(screen.getByTestId('recipes-generate-close')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate-close'))

  expect(router.dismiss).toHaveBeenCalled()
  expect(screen.queryByText('Effacer cette envie ?')).toBeNull()
})

test('the sheet shows the sentence the model will actually receive', async () => {
  renderComposer()

  await openRefine()

  await waitFor(() => expect(screen.getByTestId('recipes-option-regime-vegetarien')).toBeTruthy())
  fireEvent.press(screen.getByTestId('recipes-option-regime-vegetarien'))

  await waitFor(() =>
    expect(screen.getByTestId('recipes-prompt-preview')).toHaveTextContent(
      'On demandera : « Une recette végétarienne. »',
    ),
  )
})

test('the six chip groups are folded away — the composer opens as a shortcut, not a form', async () => {
  renderComposer()

  await waitFor(() => expect(screen.getByTestId('recipes-refine')).toBeTruthy())

  // 24 generic chips are what every recipe app ships; the pinnable pantry is
  // what only this one can offer. The wall does not get the first screen.
  expect(screen.queryByTestId('recipes-option-temps-express')).toBeNull()

  fireEvent.press(screen.getByTestId('recipes-refine'))

  await waitFor(() => expect(screen.getByTestId('recipes-option-temps-express')).toBeTruthy())
})

test('no pantry product is chosen for the cook — the card proposes, the tap decides', async () => {
  renderComposer()

  const chip = await waitFor(() => screen.getByTestId('recipes-pin-fake-product-1'))

  // Nothing starts selected: the backend already gets the whole garde-manger,
  // so a pin only ever *adds* an instruction to the prompt.
  expect(chip.props.accessibilityState).toMatchObject({ selected: false })

  await fireEvent.press(chip)

  await waitFor(() =>
    expect(screen.getByTestId('recipes-pin-fake-product-1').props.accessibilityState).toMatchObject({ selected: true }),
  )
})

test('the "Sous la main" pantry card is retractable', async () => {
  renderComposer()

  await waitFor(() => expect(screen.getByTestId('recipes-pin-fake-product-1')).toBeTruthy())

  const toggle = screen.getByTestId('recipes-cooking-from-toggle')
  expect(toggle.props.accessibilityState.expanded).toBe(true)

  fireEvent.press(toggle)

  expect(screen.queryByTestId('recipes-pin-fake-product-1')).toBeNull()
  expect(toggle.props.accessibilityState.expanded).toBe(false)
})
