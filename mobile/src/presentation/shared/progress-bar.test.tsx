import { render, screen } from '@testing-library/react-native'
import { ThemeProvider } from './theme-provider.js'
import { ProgressBar } from './progress-bar.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

function Bar(props: { value?: number; total?: number }) {
  const palette = useSoftPalette()
  return <ProgressBar palette={palette} testID="bar" label="Chargement" {...props} />
}

function renderBar(props: { value?: number; total?: number }) {
  return render(
    <ThemeProvider>
      <Bar {...props} />
    </ThemeProvider>,
  )
}

test('determinate: announces its progress to assistive tech', async () => {
  await renderBar({ value: 3, total: 5 })

  const bar = screen.getByTestId('bar')
  expect(bar.props.role).toBe('progressbar')
  expect(bar.props.accessibilityValue).toMatchObject({ min: 0, max: 5, now: 3 })
})

test('indeterminate: still a progressbar, without a value', async () => {
  await renderBar({})

  expect(screen.getByTestId('bar').props.role).toBe('progressbar')
})
