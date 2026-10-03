import { fireEvent } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { Text } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import NotFoundRoute from '../../app/+not-found.js'
import { redirectSystemPath } from '../../app/+native-intent.js'

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }

test.each(['/page-inexistante', '/fridge/absent/route-inexistante', 'gardemanger://page-inexistante'])(
  'an unknown route or deep link %s offers a working escape',
  async (initialUrl) => {
    const app = renderRouter(
      {
        _layout: () => <SafeAreaProvider initialMetrics={metrics}><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>,
        index: () => <Text>Accueil valide</Text>,
        '+not-found': NotFoundRoute,
      },
      { initialUrl },
    )
    expect(app.getByRole('header', { name: 'Page introuvable' })).toBeTruthy()
    await fireEvent.press(app.getByRole('button', { name: 'Revenir à l’accueil' }))
    expect(await app.findByText('Accueil valide')).toBeTruthy()
    expect(app.getPathname()).toBe('/')
  },
)

test('native intents preserve unknown links for the router fallback and still handle shared files', () => {
  expect(redirectSystemPath({ path: 'gardemanger://page-inexistante', initial: true })).toBe('gardemanger://page-inexistante')
  expect(redirectSystemPath({ path: 'gardemanger://dataUrl=shared-file', initial: true })).toBe('/')
})
