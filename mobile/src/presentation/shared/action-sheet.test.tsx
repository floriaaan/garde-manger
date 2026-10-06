import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from './theme-provider.js'
import { ActionSheet, type ActionSheetOption } from './action-sheet.js'

function option(overrides: Partial<ActionSheetOption>): ActionSheetOption {
  return { testID: 'opt-a', label: 'A', icon: () => null, tint: '#000', onPress: jest.fn(), ...overrides }
}

test('renders nothing when not visible', async () => {
  await render(
    <ThemeProvider>
      <ActionSheet visible={false} onClose={jest.fn()} options={[option({})]} />
    </ThemeProvider>,
  )

  expect(screen.queryByTestId('opt-a')).toBeNull()
})

test('renders one pressable row per option and calls its onPress when tapped', async () => {
  const onPress = jest.fn()
  await render(
    <ThemeProvider>
      <ActionSheet visible onClose={jest.fn()} options={[option({ onPress })]} />
    </ThemeProvider>,
  )

  await fireEvent.press(screen.getByTestId('opt-a'))

  expect(onPress).toHaveBeenCalledTimes(1)
})

test('a pending option exposes its busy state and prevents another press', async () => {
  const onPress = jest.fn()
  await render(
    <ThemeProvider>
      <ActionSheet visible onClose={jest.fn()} options={[option({ onPress, pending: true })]} />
    </ThemeProvider>,
  )
  expect(screen.getByTestId('opt-a')).toBeDisabled()
  expect(screen.getByTestId('opt-a').props.accessibilityState.busy).toBe(true)
  expect(screen.getByTestId('opt-a-spinner')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('opt-a'))
  expect(onPress).not.toHaveBeenCalled()
})

test('pressing the backdrop calls onClose', async () => {
  const onClose = jest.fn()
  await render(
    <ThemeProvider>
      <ActionSheet visible onClose={onClose} options={[]} />
    </ThemeProvider>,
  )

  // The scrim is deliberately out of the accessibility tree — it is an
  // unlabeled full-screen surface, and "Annuler" is the exit that says what it
  // does — so the query has to opt into hidden elements to reach it. That it
  // is hidden is the assertion, not an inconvenience.
  const backdrop = screen.getByTestId('action-sheet-backdrop', { includeHiddenElements: true })
  expect(backdrop.props.accessibilityElementsHidden).toBe(true)

  await fireEvent.press(backdrop)

  expect(onClose).toHaveBeenCalledTimes(1)
})
