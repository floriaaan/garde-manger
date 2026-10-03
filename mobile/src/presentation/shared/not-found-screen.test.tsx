import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import type * as Linking from 'expo-linking'
import { Text } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import NotFoundRoute from '../../app/+not-found.js'
import { redirectSystemPath } from '../../app/+native-intent.js'

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

// React Native aliases window to globalThis; the Node test environment
// does not, and Expo skips native initial links when window is absent.
beforeAll(() => Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis }))
afterAll(() => {
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
  else Reflect.deleteProperty(globalThis, 'window')
})

afterEach(() => jest.restoreAllMocks())

test.each(['/page-inexistante', '/fridge/absent/route-inexistante', 'gardemanger://page-inexistante'])(
  'an unknown route or deep link %s offers a working escape',
  async (initialUrl) => {
    const nativeLink = initialUrl.startsWith('gardemanger://')
    // A native URL must enter through Linking: initialUrl simulates a web
    // location, whose pathname excludes the custom scheme's route host.
    if (nativeLink) jest.spyOn(jest.requireMock<typeof Linking>('expo-linking'), 'getLinkingURL').mockReturnValue(initialUrl)
    await renderRouter(
      {
        _layout: () => <SafeAreaProvider initialMetrics={metrics}><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>,
        index: () => <Text>Accueil valide</Text>,
        '+not-found': NotFoundRoute,
      },
      { initialUrl: nativeLink ? null : initialUrl },
    )
    expect(screen.getByRole('header', { name: 'Page introuvable' })).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Revenir à l’accueil' }))
    expect(await screen.findByText('Accueil valide')).toBeTruthy()
  },
)

test('native intents preserve unknown links for the router fallback and still handle shared files', () => {
  expect(redirectSystemPath({ path: 'gardemanger://page-inexistante', initial: true })).toBe('gardemanger://page-inexistante')
  expect(redirectSystemPath({ path: 'gardemanger://dataUrl=shared-file', initial: true })).toBe('/')
})
