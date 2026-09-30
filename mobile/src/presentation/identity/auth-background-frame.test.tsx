import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { ThemeProvider as NavigationThemeProvider, useSegments } from 'expo-router'
import { AuthBackgroundFrame } from './auth-background-frame.js'
import { AuthBlobBackground } from './auth-blob-background.js'

const mockMount = jest.fn()
const mockUnmount = jest.fn()
jest.mock('expo-router', () => ({
  useSegments: jest.fn(),
  useTheme: () => ({ dark: false, colors: { background: '#navigation-ground', primary: '#primary' } }),
  ThemeProvider: jest.fn(({ children }) => children),
}))
jest.mock('../dashboard/soft-palette.js', () => ({ useSoftPalette: () => ({ cream: '#fff' }) }))
jest.mock('./auth-blob-background.js', () => ({
  AuthBlobBackground: jest.fn(() => {
    const { useEffect } = require('react')
    useEffect(() => { mockMount(); return mockUnmount }, [])
    return null
  }),
}))

test('keeps one background mounted across entry pages and pauses outside entry', async () => {
  jest.mocked(useSegments).mockReturnValue(['(auth)', 'sign-in'])
  const view = await render(<AuthBackgroundFrame><Text>Connexion</Text></AuthBackgroundFrame>)
  expect(mockMount).toHaveBeenCalledTimes(1)
  expect(jest.mocked(NavigationThemeProvider).mock.lastCall?.[0].value?.colors).toEqual({ background: 'transparent', primary: '#primary' })

  jest.mocked(useSegments).mockReturnValue(['(onboarding)'])
  await view.rerender(<AuthBackgroundFrame><Text>Votre foyer</Text></AuthBackgroundFrame>)
  expect(mockMount).toHaveBeenCalledTimes(1)
  expect(mockUnmount).not.toHaveBeenCalled()
  expect(jest.mocked(AuthBlobBackground).mock.lastCall?.[0]).toEqual({ ground: '#fff', active: true })
  expect(jest.mocked(NavigationThemeProvider).mock.lastCall?.[0].value?.colors.background).toBe('transparent')

  jest.mocked(useSegments).mockReturnValue(['(tabs)'])
  await view.rerender(<AuthBackgroundFrame><Text>Accueil</Text></AuthBackgroundFrame>)
  expect(mockMount).toHaveBeenCalledTimes(1)
  expect(mockUnmount).not.toHaveBeenCalled()
  expect(jest.mocked(AuthBlobBackground).mock.lastCall?.[0]).toEqual({ ground: '#fff', active: false })
  expect(jest.mocked(NavigationThemeProvider).mock.lastCall?.[0].value?.colors.background).toBe('#navigation-ground')
})
