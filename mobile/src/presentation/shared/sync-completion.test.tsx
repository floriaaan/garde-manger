import { AccessibilityInfo, Animated, Platform } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { SyncCompletion } from './sync-completion.js'
import { ThemeProvider } from './theme-provider.js'
import { useReduceMotion } from './hover.js'

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]) }
})
jest.mock('./hover.js', () => ({ ...jest.requireActual('./hover.js'), useReduceMotion: jest.fn(() => true), useScreenReader: jest.fn(() => false) }))

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false)
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

test('shows a static accessible success under Reduce Motion before dismissing', async () => {
  const done = jest.fn()
  const spring = jest.spyOn(Animated, 'spring')
  const view = await render(<ThemeProvider><SyncCompletion onDone={done} /></ThemeProvider>)
  expect(screen.getByRole('status')).toHaveTextContent('Tout est réglé')
  expect(spring).not.toHaveBeenCalled()
  await act(() => { jest.advanceTimersByTime(3499) })
  expect(done).not.toHaveBeenCalled()
  await act(() => { jest.advanceTimersByTime(1) })
  expect(done).toHaveBeenCalledTimes(1)
  await view.unmount()
})

test('screen readers have time to hear the result before dismissal', async () => {
  jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true)
  const done = jest.fn()
  const view = await render(<ThemeProvider><SyncCompletion onDone={done} synced={2} /></ThemeProvider>)
  expect(screen.getByText('2 modifications synchronisées')).toBeTruthy()
  await act(() => { jest.advanceTimersByTime(7999) })
  expect(done).not.toHaveBeenCalled()
  await act(() => { jest.advanceTimersByTime(1) })
  expect(done).toHaveBeenCalledTimes(1)
  await view.unmount()
})

test('Android respects its recommended accessibility timeout', async () => {
  jest.replaceProperty(Platform, 'OS', 'android')
  jest.spyOn(AccessibilityInfo, 'getRecommendedTimeoutMillis').mockResolvedValue(15000)
  const done = jest.fn()
  const view = await render(<ThemeProvider><SyncCompletion onDone={done} synced={1} /></ThemeProvider>)
  await act(() => { jest.advanceTimersByTime(14999) })
  expect(done).not.toHaveBeenCalled()
  await act(() => { jest.advanceTimersByTime(1) })
  expect(done).toHaveBeenCalledTimes(1)
  await view.unmount()
})

test('touching the confirmation suspends automatic navigation', async () => {
  const done = jest.fn()
  const view = await render(<ThemeProvider><SyncCompletion onDone={done} synced={1} /></ThemeProvider>)
  await fireEvent(screen.getByTestId('sync-completion'), 'touchStart')
  await act(() => { jest.advanceTimersByTime(30000) })
  expect(done).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }))
  expect(done).toHaveBeenCalledTimes(1)
  await view.unmount()
})

test('discarded and mixed outcomes do not claim every change was synchronized', async () => {
  jest.mocked(useReduceMotion).mockReturnValue(false)
  const spring = jest.spyOn(Animated, 'spring')
  const view = await render(<ThemeProvider><SyncCompletion onDone={() => {}} cancelled={1} /></ThemeProvider>)
  expect(screen.getByRole('status')).toHaveTextContent('Modifications annulées')
  expect(screen.getByText('1 modification annulée')).toBeTruthy()
  expect(screen.queryByText('Tout est réglé')).toBeNull()
  await view.rerender(<ThemeProvider><SyncCompletion onDone={() => {}} synced={2} cancelled={1} /></ThemeProvider>)
  expect(screen.getByRole('status')).toHaveTextContent('Toutes les actions sont traitées')
  expect(screen.getByText('2 modifications synchronisées · 1 modification annulée')).toBeTruthy()
  expect(spring).not.toHaveBeenCalled()
  await view.unmount()
  jest.mocked(useReduceMotion).mockReturnValue(true)
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
  const view = await render(<ThemeProvider><SyncCompletion onDone={() => {}} synced={1} /></ThemeProvider>)
  expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, useNativeDriver: true }))
  await view.unmount()
  jest.mocked(useReduceMotion).mockReturnValue(true)
})
