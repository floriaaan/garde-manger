import { Animated } from 'react-native'
import { act, render, screen } from '@testing-library/react-native'
import { SyncCompletion } from './sync-completion.js'
import { ThemeProvider } from './theme-provider.js'
import { useReduceMotion } from './hover.js'

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]) }
})
jest.mock('./hover.js', () => ({ ...jest.requireActual('./hover.js'), useReduceMotion: jest.fn(() => true) }))

beforeEach(() => jest.useFakeTimers())
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

test('shows a static accessible success under Reduce Motion before dismissing', async () => {
  const done = jest.fn()
  const spring = jest.spyOn(Animated, 'spring')
  const view = await render(<ThemeProvider><SyncCompletion onDone={done} /></ThemeProvider>)
  expect(screen.getByRole('status')).toHaveTextContent('Tout est réglé')
  expect(spring).not.toHaveBeenCalled()
  await act(() => { jest.advanceTimersByTime(1799) })
  expect(done).not.toHaveBeenCalled()
  await act(() => { jest.advanceTimersByTime(1) })
  expect(done).toHaveBeenCalledTimes(1)
  await view.unmount()
})

test('leaving the success screen cancels automatic dismissal', async () => {
  const done = jest.fn()
  const view = await render(<ThemeProvider><SyncCompletion onDone={done} /></ThemeProvider>)
  await view.unmount()
  await act(() => { jest.advanceTimersByTime(3000) })
  expect(done).not.toHaveBeenCalled()
})

test('the playful checkmark pop uses the shared motion preference', async () => {
  jest.mocked(useReduceMotion).mockReturnValue(false)
  const spring = jest.spyOn(Animated, 'spring')
  const view = await render(<ThemeProvider><SyncCompletion onDone={() => {}} /></ThemeProvider>)
  expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, useNativeDriver: true }))
  await view.unmount()
  jest.mocked(useReduceMotion).mockReturnValue(true)
})
