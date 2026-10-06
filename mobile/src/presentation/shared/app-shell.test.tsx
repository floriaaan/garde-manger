import { fireEvent, render, screen } from '@testing-library/react-native'
import { View } from 'react-native'
import { router } from 'expo-router'
import { AppShell, shellContentStyle, type AppShellNav } from './app-shell.js'
import { ThemeProvider } from './theme-provider.js'

let mockWidth = 320

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native')
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default },
    useWindowDimensions: () => ({ width: mockWidth, height: 800, scale: 1, fontScale: 1 }),
  }
})
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }))
jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { SafeAreaView: (props: Record<string, unknown>) => React.createElement(View, props) }
})
jest.mock('./blob-background.js', () => ({ BlobBackground: () => null }))

beforeEach(() => {
  mockWidth = 320
  jest.clearAllMocks()
})

async function renderShell(nav: AppShellNav) {
  await render(<ThemeProvider><AppShell nav={nav}><View testID="page-content" /></AppShell></ThemeProvider>)
}

test.each([320, 390, 640, 767])('narrow web at %ipx keeps all destinations and scanning available', async (width) => {
  mockWidth = width
  const onScan = jest.fn()
  await renderShell({ kind: 'tab', tab: 'frigo', onScan })

  expect(screen.getByTestId('web-tab-nav')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Garde-manger' }).props['aria-current']).toBe('page')
  for (const [label, route] of [
    ['Accueil', '/(tabs)'],
    ['Recettes', '/(tabs)/recipes'],
    ['Courses', '/(tabs)/shopping-list'],
  ]) {
    expect(screen.getByRole('button', { name: label }).props['aria-current']).toBeUndefined()
    await fireEvent.press(screen.getByRole('button', { name: label }))
    expect(router.navigate).toHaveBeenLastCalledWith(route)
  }

  jest.mocked(router.navigate).mockClear()
  await fireEvent.press(screen.getByRole('button', { name: 'Garde-manger' }))
  expect(router.navigate).not.toHaveBeenCalled()
  expect(screen.getByText('Scanner')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Scanner le frigo, un produit ou un ticket de caisse' }))
  expect(onScan).toHaveBeenCalledTimes(1)
})

test('the sidebar replaces the web footer at the 768px breakpoint', async () => {
  mockWidth = 768
  await renderShell({ kind: 'tab', tab: 'accueil', onScan: jest.fn() })
  expect(screen.queryByTestId('web-tab-nav')).toBeNull()
  expect(screen.getByRole('button', { name: 'Réglages' })).toBeTruthy()
})

test.each<AppShellNav>([{ kind: 'stack' }, { kind: 'modal' }])('a $kind screen carries no web footer', async (nav) => {
  await renderShell(nav)
  expect(screen.queryByTestId('web-tab-nav')).toBeNull()
  expect(screen.queryByTestId('scan-fab')).toBeNull()
})

test('scroll clearance accounts for the scan action while the web footer occupies its own space', () => {
  expect(shellContentStyle({ isWide: false, hasMobileNav: true }).paddingBottom).toBe(88)
  expect(shellContentStyle({ isWide: false, hasMobileNav: false }).paddingBottom).toBe(40)
})
