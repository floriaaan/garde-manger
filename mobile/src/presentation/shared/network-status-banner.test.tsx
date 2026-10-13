import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, Platform } from 'react-native'
import { router } from 'expo-router'
import { MutationQueue } from '../../application/sync/mutation-queue.js'
import { Result } from '../../domain/shared/result.js'
import { createFakeMutationQueueStorage } from '../../infrastructure/fake/fake-mutation-queue.js'
import { fakeSession } from '../../infrastructure/fake/fixtures/session.fixture.js'
import { fakeHousehold } from '../../infrastructure/fake/fixtures/household.fixture.js'
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
  expect(screen.getByText(/1 changement enregistré/)).toBeTruthy()
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


test('the restored-connection banner keeps a link to queued actions even during an empty status snapshot', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const ui = () => <ThemeProvider><NetworkStatusBanner /></ThemeProvider>
  const view = await render(ui())
  await measure()
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  expect(screen.getByRole('status')).toHaveTextContent('Connexion rétablie')
  await fireEvent.press(screen.getByRole('button', { name: 'Voir les changements à synchroniser' }))
  expect(router.push).toHaveBeenCalledWith('/pending-actions')
  await view.unmount()
})

test('fake fixture conflicts keep the action link after the nine pending actions are delivered', async () => {
  jest.mocked(useConnectivity).mockReturnValue(false)
  const scope = { server: 'fake-server', userId: fakeSession.user.id, householdId: fakeHousehold.id }
  const send = jest.fn(async () => Result.ok(undefined))
  const queue = new MutationQueue(createFakeMutationQueueStorage(scope.server), () => scope, send, () => {}, () => {})
  await queue.pending()
  const ui = () => <ThemeProvider><NetworkStatusBanner queue={queue} /></ThemeProvider>
  const view = await render(ui())
  await measure()
  expect(queue.status().entries).toHaveLength(12)
  jest.mocked(useConnectivity).mockReturnValue(true)
  await view.rerender(ui())
  await act(async () => { await queue.flush(true); jest.advanceTimersByTime(10000) })
  expect(send).toHaveBeenCalledTimes(9)
  expect(await queue.pending()).toEqual([])
  expect(await queue.failures()).toHaveLength(3)
  expect(screen.getByRole('status')).toHaveTextContent('Action requise pour synchroniser')
  await fireEvent.press(screen.getByRole('button', { name: 'Voir les changements à synchroniser' }))
  expect(router.push).toHaveBeenCalledWith('/pending-actions')
  await act(async () => { await queue.flush(true) })
  expect(send).toHaveBeenCalledTimes(9)
  expect(await queue.failures()).toHaveLength(3)
  await view.unmount()
})


test('announces native phase transitions rather than every remaining-action counter update', async () => {
  const originalOS = Platform.OS
  Platform.OS = 'ios'
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
  jest.mocked(useConnectivity).mockReturnValue(true)
  let finishFirst!: () => void
  let finishSecond!: () => void
  let startedFirst!: () => void
  let startedSecond!: () => void
  const first = new Promise<void>((resolve) => { startedFirst = resolve })
  const second = new Promise<void>((resolve) => { startedSecond = resolve })
  const send = jest.fn()
    .mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => { finishFirst = resolve; startedFirst() })
      return Result.ok(undefined)
    })
    .mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => { finishSecond = resolve; startedSecond() })
      return Result.ok(undefined)
    })
  const queue = new MutationQueue({ read: async () => [], write: async () => {} },
    () => ({ server: 'server', userId: 'user', householdId: 'home' }), send, () => {}, () => {})
  try {
    const view = await render(<ThemeProvider><NetworkStatusBanner queue={queue} /></ThemeProvider>)
    await act(async () => { await queue.enqueue('shopping-items', fakeShoppingItems[0], { checked: true }) })
    await act(async () => { await queue.enqueue('shopping-items', { ...fakeShoppingItems[0], id: 'bread' }, { checked: true }) })
    expect(announce.mock.calls).toEqual([['Synchronisation en attente']])
    let replay!: Promise<void>
    await act(async () => { replay = queue.flush(); await first })
    await act(async () => { finishFirst(); await second })
    expect(screen.getByRole('status')).toHaveTextContent('Synchronisation en cours')
    expect(screen.getByText(/1 changement enregistré/)).toBeTruthy()
    expect(announce.mock.calls).toEqual([['Synchronisation en attente'], ['Synchronisation en cours']])
    await act(async () => { finishSecond(); await replay })
    await view.unmount()
  } finally {
    Platform.OS = originalOS
    announce.mockRestore()
  }
})
