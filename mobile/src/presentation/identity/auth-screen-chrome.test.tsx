import { fireEvent, render } from '@testing-library/react-native'
import { Keyboard, Platform, TextInput, View } from 'react-native'
import { AuthScreenChrome } from './auth-screen-chrome.js'

// Expose the dismiss wrapper without relying on renderer internals.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native')
  const React = require('react')
  return {
    ...actual,
    TouchableWithoutFeedback: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(actual.View, { ...props, testID: 'keyboard-dismiss-area' }, children),
  }
})
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }
})
jest.mock('expo-font', () => ({ useFonts: () => [true] }))
jest.mock('./auth-wordmark.js', () => ({ AuthWordmark: () => null }))
jest.mock('./auth-background-frame.js', () => ({ useSharedAuthBackground: () => false }))
jest.mock('../dashboard/soft-palette.js', () => ({ useSoftPalette: () => ({ cream: '#fff' }) }))

afterEach(() => jest.restoreAllMocks())

test('web auth inputs have no ancestor that dismisses the keyboard', async () => {
  jest.replaceProperty(Platform, 'OS', 'web')
  const dismiss = jest.spyOn(Keyboard, 'dismiss')
  const change = jest.fn()
  const view = await render(
    <AuthScreenChrome maxWidth={440} hero={<View />}>
      <TextInput testID="email" onChangeText={change} />
    </AuthScreenChrome>,
  )
  expect(view.queryByTestId('keyboard-dismiss-area')).toBeNull()
  await fireEvent.press(view.getByTestId('email'))
  await fireEvent.changeText(view.getByTestId('email'), 'alice@example.com')
  expect(dismiss).not.toHaveBeenCalled()
  expect(change).toHaveBeenCalledWith('alice@example.com')
})

test.each(['ios', 'android'] as const)('%s retains tap-outside keyboard dismissal', async (os) => {
  jest.replaceProperty(Platform, 'OS', os)
  const dismiss = jest.spyOn(Keyboard, 'dismiss')
  const view = await render(
    <AuthScreenChrome maxWidth={440} hero={<View />}>
      <TextInput testID="email" />
    </AuthScreenChrome>,
  )
  await fireEvent.press(view.getByTestId('keyboard-dismiss-area'))
  expect(dismiss).toHaveBeenCalledTimes(1)
})
