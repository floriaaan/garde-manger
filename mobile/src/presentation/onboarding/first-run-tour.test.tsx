import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Animated, type ScrollView } from 'react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FirstRunTour } from './first-run-tour.js'

const mockMeasure = jest.fn()
jest.mock('./tour-anchors.js', () => ({ useTourAnchors: () => ({ measure: mockMeasure }) }))
jest.mock('../shared/hover.js', () => ({
  ...jest.requireActual('../shared/hover.js'), useReduceMotion: () => true,
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockMeasure.mockResolvedValue(null)
})

async function renderTour() {
  const callbacks = { onFinish: jest.fn(), onScan: jest.fn(), onAddProduct: jest.fn(), onOpenRecipes: jest.fn() }
  const scrollTo = jest.fn()
  await render(
    <ThemeProvider>
      <FirstRunTour
        scrollRef={{ current: { scrollTo } as unknown as ScrollView }}
        scrollOffset={{ current: 0 }}
        {...callbacks}
      />
    </ThemeProvider>,
  )
  return { ...callbacks, scrollTo }
}

test('shows progress, supports back, and finishes without requiring an action', async () => {
  const { onFinish, onAddProduct, onOpenRecipes, onScan } = await renderTour()
  expect(screen.getByText('Étape 1 sur 4')).toBeTruthy()
  expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ min: 1, max: 4, now: 1 })
  await fireEvent.press(screen.getByTestId('first-run-tour-next'))
  expect(screen.getByText('Étape 2 sur 4')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('first-run-tour-back'))
  expect(screen.getByText('Étape 1 sur 4')).toBeTruthy()
  for (let step = 0; step < 4; step++) await fireEvent.press(screen.getByTestId('first-run-tour-next'))
  expect(onFinish).toHaveBeenCalledTimes(1)
  for (const action of [onAddProduct, onOpenRecipes, onScan]) expect(action).not.toHaveBeenCalled()
})

test.each([0, 1, 2, 3])('can skip at step %s', async (step) => {
  const { onFinish } = await renderTour()
  for (let i = 0; i < step; i++) await fireEvent.press(screen.getByTestId('first-run-tour-next'))
  await fireEvent.press(screen.getByTestId('first-run-tour-skip'))
  expect(onFinish).toHaveBeenCalledTimes(1)
})

test.each([
  { step: 0, id: 'inventory', callback: 'onAddProduct' },
  { step: 2, id: 'recipes', callback: 'onOpenRecipes' },
  { step: 3, id: 'scan', callback: 'onScan' },
] as const)('the $id prompt dismisses before opening its real workflow', async ({ step, id, callback }) => {
  const callbacks = await renderTour()
  for (let i = 0; i < step; i++) await fireEvent.press(screen.getByTestId('first-run-tour-next'))
  await fireEvent.press(screen.getByTestId(`first-run-tour-${id}`))
  expect(callbacks.onFinish).toHaveBeenCalledTimes(1)
  expect(callbacks[callback]).toHaveBeenCalledTimes(1)
  expect(callbacks.onFinish.mock.invocationCallOrder[0]).toBeLessThan(callbacks[callback].mock.invocationCallOrder[0])
})

test('reduced motion skips the fade and scrolls without animation', async () => {
  mockMeasure.mockResolvedValue({ x: 20, y: 2000, width: 300, height: 100 })
  const timing = jest.spyOn(Animated, 'timing')
  try {
    const { scrollTo } = await renderTour()
    await waitFor(() => expect(mockMeasure).toHaveBeenCalledTimes(2))
    expect(scrollTo).toHaveBeenCalledWith({ y: 1910, animated: false })
    expect(timing).not.toHaveBeenCalled()
  } finally {
    timing.mockRestore()
  }
})
