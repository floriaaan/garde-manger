import { AppState, Platform } from 'react-native'
import { focusManager } from '@tanstack/react-query'
import { wireFocusManager } from './wire-focus-manager.js'

const originalOS = Platform.OS

afterEach(() => {
  Platform.OS = originalOS
  focusManager.setFocused(undefined)
  jest.restoreAllMocks()
})

test.each(['ios', 'android'] as const)('%s propagates repeated background/foreground transitions and removes the listener', (os) => {
  Platform.OS = os
  let listener: (state: 'active' | 'background' | 'inactive') => void = () => {}
  const remove = jest.fn()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    listener = callback
    return { remove }
  })
  const stop = wireFocusManager()
  for (let i = 0; i < 3; i++) {
    listener('inactive')
    expect(focusManager.isFocused()).toBe(false)
    listener('background')
    expect(focusManager.isFocused()).toBe(false)
    listener('active')
    expect(focusManager.isFocused()).toBe(true)
  }
  stop()
  expect(remove).toHaveBeenCalledTimes(1)
})

test('web retains its browser focus handling', () => {
  Platform.OS = 'web'
  const subscribe = jest.spyOn(AppState, 'addEventListener')
  wireFocusManager()()
  expect(subscribe).not.toHaveBeenCalled()
})
