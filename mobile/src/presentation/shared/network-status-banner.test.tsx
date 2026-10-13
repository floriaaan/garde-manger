import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { MutationQueue } from '../../application/sync/mutation-queue.js'
import { Result } from '../../domain/shared/result.js'
import { fakeShoppingItems } from '../../infrastructure/fake/fixtures/shopping-item.fixture.js'
import * as Reanimated from 'react-native-reanimated'
import { useConnectivity } from '../../application/shared/use-connectivity.js'
import { ThemeProvider } from './theme-provider.js'
import { NetworkStatusBanner } from './network-status-banner.js'
import { useReduceMotion } from './hover.js'

jest.mock('../../application/shared/use-connectivity.js', () => ({ useConnectivity: jest.fn() }))
jest.mock('./hover.js', () => ({ ...jest.requireActual('./hover.js'), useReduceMotion: jest.fn() }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

Reanimated.setUpTests()

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(useConnectivity).mockReturnValue(undefined)
  jest.mocked(useReduceMotion).mockReturnValue(false)
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

async function measure(height = 110) {
  await fireEvent(screen.getByTestId('network-status-content'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
  })
}

test('unknown and initial online states are silent; offline persists and recovery dismisses', async () => {
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  jest.mocked(useConnectivity).mockReturnValue(false)
  await view.rerender(ui())
  await measure()
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  await act(() => { jest.advanceTimersByTime(10000) })
  expect(screen.getByTestId('network-status-banner')).toBeTruthy()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await measure(88)
  expect(screen.getByRole('status')).toHaveTextContent('Connexion rétablie')
  await act(() => { jest.advanceTimersByTime(3500) })
  expect(screen.getByTestId('network-status-banner')).toBeTruthy()
  await act(() => { jest.advanceTimersByTime(250) })
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  await view.unmount()
})

test('an offline cold start alerts immediately; another outage cancels recovery dismissal', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  await measure()
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await act(() => { jest.advanceTimersByTime(1000) })
  jest.mocked(useConnectivity).mockReturnValue(false)
  await view.rerender(ui())
  await act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  await view.unmount()
})

test('a new outage interrupts the closing animation without unmounting the alert', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  await measure()
  await act(() => { jest.advanceTimersByTime(300) })
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await measure(88)
  await act(() => { jest.advanceTimersByTime(3500) })
  await act(() => { jest.advanceTimersByTime(90) })
  jest.mocked(useConnectivity).mockReturnValue(false)
  await view.rerender(ui())
  await measure()
  await act(() => { jest.advanceTimersByTime(1000) })
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  await view.unmount()
})

test('Reduce Motion makes opening and closing immediate after measurement', async () => {
  jest.mocked(useReduceMotion).mockReturnValue(true)
  jest.mocked(useConnectivity).mockReturnValue(false)
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  await measure()
  // Shared styles commit on the next UI frame, with no timed interpolation.
  await act(() => { jest.advanceTimersByTime(17) })
  expect(screen.getByTestId('network-status-region')).toHaveAnimatedStyle({ height: 110 })
  expect(screen.getByRole('status')).toHaveTextContent(/Hors connexion/)
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await act(() => { jest.advanceTimersByTime(3500) })
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  await view.unmount()
})

test('height progresses between measured endpoints instead of jumping', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const view = await render(<ThemeProvider><NetworkStatusBanner /></ThemeProvider>)
  await measure()
  await act(() => { jest.advanceTimersByTime(120) })
  const { height } = Reanimated.getAnimatedStyle(screen.getByTestId('network-status-region'))
  expect(height).toBeGreaterThan(0)
  expect(height).toBeLessThan(110)
  await act(() => { jest.advanceTimersByTime(200) })
  expect(screen.getByTestId('network-status-region')).toHaveAnimatedStyle({ height: 110 })
  await view.unmount()
})

test('queued edits expose details and actual synchronization; success removes persistent chrome', async () => {
  jest.mocked(useConnectivity).mockReturnValue(true)
  let finish!: () => void
  let started!: () => void
  const sending = new Promise<void>((resolve) => { started = resolve })
  const queue = new MutationQueue({ read: async () => [], write: async () => {} },
    () => ({ server: 'server', userId: 'user', householdId: 'home' }),
    async () => { await new Promise<void>((resolve) => { finish = resolve; started() }); return Result.ok(undefined) },
    () => {}, () => {})
  const view = await render(<ThemeProvider><NetworkStatusBanner queue={queue} /></ThemeProvider>)
  expect(screen.queryByRole('status')).toBeNull()
  await act(async () => { await queue.enqueue('shopping-items', fakeShoppingItems[0], { checked: true }) })
  await measure()
  expect(screen.getByRole('status')).toHaveTextContent('Synchronisation en attente')
  expect(screen.getByRole('status')).toHaveTextContent('1 changement enregistré')
  await fireEvent.press(screen.getByRole('button', { name: 'Voir les changements à synchroniser' }))
  expect(router.push).toHaveBeenCalledWith('/pending-actions')
  let flushing!: Promise<void>
  await act(async () => { flushing = queue.flush(); await sending })
  expect(screen.getByRole('status')).toHaveTextContent('Synchronisation en cours')
  await act(async () => { finish(); await flushing })
  expect(screen.queryByRole('status')).toBeNull()
  await view.unmount()
})

test('temporary outages stay pending; permanent refusals require attention and retain local edits', async () => {
  jest.mocked(useConnectivity).mockReturnValue(true)
  const send = jest.fn().mockResolvedValueOnce(Result.err({ type: 'network_error', message: 'Unavailable' }))
    .mockResolvedValueOnce(Result.err({ type: 'forbidden', message: 'Denied' }))
  const queue = new MutationQueue({ read: async () => [], write: async () => {} },
    () => ({ server: 'server', userId: 'user', householdId: 'home' }), send, () => {}, () => {})
  const view = await render(<ThemeProvider><NetworkStatusBanner queue={queue} /></ThemeProvider>)
  await act(async () => {
    await queue.enqueue('shopping-items', fakeShoppingItems[0], { checked: true })
    await queue.flush()
  })
  expect(screen.getByRole('status')).toHaveTextContent('Synchronisation en attente')
  expect(screen.getByRole('status')).not.toHaveTextContent(/session|Reconnectez/)
  await act(async () => { await queue.flush(true) })
  expect(screen.getByRole('status')).toHaveTextContent('Action requise pour synchroniser')
  expect((await queue.failures())[0].patch).toEqual({ checked: true })
  await view.unmount()
})


test('offline details reuse the existing pending-actions modal even with no queued actions', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  await render(<ThemeProvider><NetworkStatusBanner /></ThemeProvider>)
  await fireEvent.press(screen.getByRole('button', { name: 'Voir les changements à synchroniser' }))
  expect(router.push).toHaveBeenCalledWith('/pending-actions')
})


test.each([false, true])('reconnection keeps the banner until delivery completes and conflicts receive a human action (reduce motion: %s)', async (reduceMotion) => {
  jest.mocked(useReduceMotion).mockReturnValue(reduceMotion)
  jest.mocked(useConnectivity).mockReturnValue(false)
  let finish!: () => void
  let started!: () => void
  const sending = new Promise<void>((resolve) => { started = resolve })
  const send = jest.fn()
    .mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => { finish = resolve; started() })
      return Result.ok(undefined)
    })
    .mockResolvedValueOnce(Result.err({ type: 'sync_conflict', message: 'Changed on another device' }))
  const queue = new MutationQueue({ read: async () => [], write: async () => {} },
    () => ({ server: 'server', userId: 'user', householdId: 'home' }), send, () => {}, () => {})
  await queue.enqueue('shopping-items', fakeShoppingItems[0], { checked: true })
  await queue.enqueue('shopping-items', { ...fakeShoppingItems[0], id: 'conflicting-item' }, { name: 'Local name' })
  const ui = () => <ThemeProvider><NetworkStatusBanner queue={queue} /></ThemeProvider>
  const view = await render(ui())
  await measure()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await act(() => { jest.advanceTimersByTime(10000) })
  expect(screen.getByRole('status')).toHaveTextContent('Synchronisation en attente')
  let flushing!: Promise<void>
  await act(async () => { flushing = queue.flush(true); await sending })
  await act(() => { jest.advanceTimersByTime(10000) })
  expect(screen.getByRole('status')).toHaveTextContent('Synchronisation en cours')
  await act(async () => { finish(); await flushing })
  const conflict = (await queue.failures())[0]
  expect(conflict.patch).toEqual({ name: 'Local name' })
  await act(async () => { await queue.flush(true); jest.advanceTimersByTime(10000) })
  expect(send).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('status')).toHaveTextContent('Action requise pour synchroniser')
  expect((await queue.failures())[0].id).toBe(conflict.id)
  // Only an explicit human decision removes the conflict and starts dismissal.
  await act(async () => { await queue.cancel(conflict.id) })
  expect(screen.getByRole('status')).toHaveTextContent('Connexion rétablie')
  await act(() => { jest.advanceTimersByTime(3500) })
  await act(() => { jest.advanceTimersByTime(250) })
  expect(screen.queryByTestId('network-status-banner')).toBeNull()
  await view.unmount()
})
