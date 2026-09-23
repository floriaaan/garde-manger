/**
 * The triple tap on the logo opens `/debug` in dev builds only: a hidden
 * screen in a release build is an App Store rejection (2.3.1).
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ThemeProvider } from '../shared/theme-provider.js'
import { AuthWordmark } from './auth-wordmark.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

const dev = __DEV__
afterEach(() => {
  ;(globalThis as { __DEV__: boolean }).__DEV__ = dev
  jest.clearAllMocks()
})

async function tripleTap() {
  await render(
    <ThemeProvider>
      <AuthWordmark tone="ink" />
    </ThemeProvider>,
  )
  const logo = screen.getByText('GARDE-MANGER')
  for (let i = 0; i < 3; i++) fireEvent.press(logo)
}

test('a dev build opens the debug screen', async () => {
  await tripleTap()
  expect(router.push).toHaveBeenCalledWith('/debug')
})

test('a release build ignores the triple tap', async () => {
  ;(globalThis as { __DEV__: boolean }).__DEV__ = false
  await tripleTap()
  expect(router.push).not.toHaveBeenCalled()
})
