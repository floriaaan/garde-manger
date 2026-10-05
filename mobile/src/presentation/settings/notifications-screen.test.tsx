import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Linking } from 'react-native'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { disablePush, enablePush, isPushEnabled, pushPermissionMessage } from '../../application/push/push-notifications.js'
import { showToast } from '../../application/shared/toast.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { NotificationsScreen } from './notifications-screen.js'
import { PantryCheckupScreen } from './pantry-checkup-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('../../application/shared/toast.js', () => ({ showToast: jest.fn() }))
jest.mock('../../application/push/push-notifications.js', () => ({
  isPushEnabled: jest.fn(async () => false),
  pushPermissionMessage: jest.fn(async () => null),
  enablePush: jest.fn(async () => 'enabled'),
  disablePush: jest.fn(async () => undefined),
}))

beforeEach(() => { jest.clearAllMocks() })
afterEach(() => {
  jest.mocked(isPushEnabled).mockResolvedValue(false)
  jest.mocked(pushPermissionMessage).mockResolvedValue(null)
  focusManager.setFocused(undefined)
})

function renderSettings(Component: typeof NotificationsScreen, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<ThemeProvider><QueryClientProvider client={queryClient}>
    <ConnectorProvider connector={connector}><Component /></ConnectorProvider>
  </QueryClientProvider></ThemeProvider>)
  return connector
}

test('Notifications opens both reminder pages and holds the global switch', async () => {
  renderSettings(NotificationsScreen)
  await waitFor(() => expect(screen.getByText('Une fois par semaine, le lundi.')).toBeTruthy())
  fireEvent.press(screen.getByTestId('notifications-expiry-reminders'))
  expect(router.push).toHaveBeenCalledWith('/expiry-reminders')
  fireEvent.press(screen.getByTestId('notifications-pantry-checkup'))
  expect(router.push).toHaveBeenCalledWith('/pantry-checkup')
  expect(screen.getByTestId('settings-notifications-switch')).toBeTruthy()
  expect(screen.getByTestId('notifications-expiry-reminders').props.accessibilityLabel).toBe(
    'Rappel de péremption. Activé pour le foyer. 2 jours avant la péremption. Modifier ce rappel.',
  )
  expect(screen.getByTestId('notifications-pantry-checkup').props.accessibilityLabel).toBe(
    'Check-up du garde-manger. Activé pour le foyer. Une fois par semaine, le lundi. Modifier ce rappel.',
  )
  expect(screen.getByText('2 jours avant la péremption.')).toBeTruthy()
})

test('the global switch enables and disables notifications on this device', async () => {
  const connector = renderSettings(NotificationsScreen)
  await waitFor(() => expect(screen.getByText('Une fois par semaine, le lundi.')).toBeTruthy())
  await waitFor(() => expect(screen.getByTestId('settings-notifications').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(screen.getByTestId('settings-notifications'))
  await waitFor(() => expect(screen.getByTestId('settings-notifications-switch').props.value).toBe(true))
  expect(enablePush).toHaveBeenCalledWith(connector, undefined)
  fireEvent.press(screen.getByTestId('settings-notifications'))
  await waitFor(() => expect(screen.getByTestId('settings-notifications-switch').props.value).toBe(false))
  expect(disablePush).toHaveBeenCalledWith(connector)
  expect(showToast).toHaveBeenLastCalledWith('Notifications désactivées sur cet appareil.', 'success')
})

test('the weekly check-up defaults to Monday, saves its weekday and can be disabled independently', async () => {
  const connector = renderSettings(PantryCheckupScreen)
  await waitFor(() => expect(screen.getByTestId('checkup-day-1').props.accessibilityState.selected).toBe(true))
  expect(screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(
    ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
  )
  expect(screen.getByTestId('checkup-day-1').props.accessibilityState.checked).toBe(true)
  expect(screen.getByTestId('checkup-enabled').props.value).toBe(true)
  fireEvent.press(screen.getByTestId('checkup-day-5'))
  await waitFor(() => expect(screen.getByTestId('checkup-day-5').props.accessibilityState.selected).toBe(true))
  fireEvent.press(screen.getByRole('switch', { name: 'Activer le check-up pour le foyer' }))
  await waitFor(() => expect(screen.getByTestId('checkup-enabled').props.value).toBe(false))
  expect(await connector.getReminderSettings()).toMatchObject({
    enabled: true, days: 2, checkupEnabled: false, checkupDay: 5,
  })
  expect(screen.queryByTestId('settings-notifications-switch')).toBeNull()
  expect(screen.queryByTestId('checkup-day-5')).toBeNull()
  expect(screen.queryByText('Quel jour de la semaine ?')).toBeNull()
  fireEvent(screen.getByTestId('checkup-enabled'), 'valueChange', true)
  await waitFor(() => expect(screen.getByTestId('checkup-day-5').props.accessibilityState.selected).toBe(true))
})

test.each(['rejection', 'result'] as const)('a failed save (%s) retains the previous setting and offers toast retry', async (failure) => {
  const connector = new FakeFridgeConnector()
  const save = jest.spyOn(connector, 'setReminderSettings')
  if (failure === 'rejection') save.mockRejectedValueOnce(new Error('network'))
  else save.mockResolvedValueOnce({ ok: false, error: { type: 'network_error', message: 'Offline' } })
  renderSettings(PantryCheckupScreen, connector)
  await waitFor(() => expect(screen.getByTestId('checkup-enabled').props.value).toBe(true))
  fireEvent(screen.getByTestId('checkup-enabled'), 'valueChange', false)
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Impossible d’enregistrer le rappel.', 'error',
    expect.objectContaining({ label: 'Réessayer', onPress: expect.any(Function) })))
  expect(screen.getByTestId('checkup-enabled').props.value).toBe(true)
  expect(screen.getByTestId('reminder-save-retry')).toBeTruthy()
  act(() => { jest.mocked(showToast).mock.calls.at(-1)?.[2]?.onPress() })
  await waitFor(() => expect(screen.getByTestId('checkup-enabled').props.value).toBe(false))
  expect(showToast).toHaveBeenLastCalledWith('Réglages enregistrés.', 'success')
  expect((await connector.getReminderSettings()).checkupEnabled).toBe(false)
})

test('a household reminder stays configurable while delivery on this device is disabled', async () => {
  renderSettings(PantryCheckupScreen)
  await waitFor(() => expect(screen.getByText('Notifications coupées sur cet appareil. Les rappels du foyer restent configurables.')).toBeTruthy())
  expect(screen.getByRole('switch', { name: 'Activer le check-up pour le foyer' }).props.accessibilityState.disabled).toBe(false)
  fireEvent.press(screen.getByTestId('device-notifications-settings'))
  expect(router.push).toHaveBeenCalledWith('/notifications')
})

test('saving announces progress, prevents changes while pending and confirms completion', async () => {
  const connector = new FakeFridgeConnector()
  let finish!: () => void
  const gate = new Promise<void>((resolve) => { finish = resolve })
  const save = connector.setReminderSettings.bind(connector)
  const mutation = jest.spyOn(connector, 'setReminderSettings').mockImplementationOnce(async (update) => {
    await gate
    return save(update)
  })
  renderSettings(PantryCheckupScreen, connector)
  await waitFor(() => expect(screen.getByTestId('checkup-day-1').props.accessibilityState.selected).toBe(true))
  fireEvent.press(screen.getByTestId('checkup-day-5'))
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Enregistrement…', 'loading'))
  expect(screen.queryByText('Enregistrement…')).toBeNull()
  expect(screen.getByTestId('checkup-day-6').props.accessibilityState.disabled).toBe(true)
  expect(screen.getByTestId('checkup-day-6').props.accessibilityState.busy).toBe(true)
  expect(mutation).toHaveBeenCalledTimes(1)
  await act(async () => { finish(); await gate })
  await waitFor(() => expect(showToast).toHaveBeenLastCalledWith('Réglages enregistrés.', 'success'))
  expect(screen.getByTestId('checkup-day-5').props.accessibilityState.selected).toBe(true)
})

test('a loading failure has a visible retry that recovers the settings', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getReminderSettings').mockRejectedValueOnce(new Error('network'))
  renderSettings(NotificationsScreen, connector)
  await waitFor(() => expect(screen.getByText('Impossible de charger les rappels.')).toBeTruthy())
  fireEvent.press(screen.getByTestId('reminder-load-retry'))
  await waitFor(() => expect(screen.getByText('2 jours avant la péremption.')).toBeTruthy())
  expect(screen.queryByTestId('reminder-load-retry')).toBeNull()
})

test('a failed global toggle shows a retry and retains the last confirmed state', async () => {
  jest.mocked(enablePush).mockRejectedValueOnce(new Error('network'))
  renderSettings(NotificationsScreen)
  await waitFor(() => expect(screen.getByTestId('settings-notifications').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(screen.getByTestId('settings-notifications'))
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Impossible de modifier les notifications.', 'error',
    expect.objectContaining({ label: 'Réessayer' })))
  expect(screen.getByTestId('settings-notifications-switch').props.value).toBe(false)
  fireEvent.press(screen.getByTestId('notifications-retry'))
  await waitFor(() => expect(screen.getByText('Réception activée sur cet appareil.')).toBeTruthy())
  expect(screen.getByTestId('settings-notifications-switch').props.value).toBe(true)
})

test('permission refusal lets the user choose when to open system settings', async () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
  jest.mocked(enablePush).mockResolvedValueOnce('denied')
  renderSettings(NotificationsScreen)
  await waitFor(() => expect(screen.getByTestId('settings-notifications').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(screen.getByTestId('settings-notifications'))
  await waitFor(() => expect(screen.getByTestId('notifications-system-settings')).toBeTruthy())
  expect(openSettings).not.toHaveBeenCalled()
  fireEvent.press(screen.getByTestId('notifications-system-settings'))
  expect(openSettings).toHaveBeenCalledTimes(1)
  openSettings.mockRestore()
})

test('a temporary activation failure offers a retry instead of blaming the device', async () => {
  jest.mocked(enablePush).mockResolvedValueOnce('failed')
  renderSettings(NotificationsScreen)
  await waitFor(() => expect(screen.getByTestId('settings-notifications').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(screen.getByTestId('settings-notifications'))
  await waitFor(() => expect(showToast).toHaveBeenCalledWith(
    'Impossible d’activer les notifications pour le moment.', 'error', expect.objectContaining({ label: 'Réessayer' }),
  ))
  expect(screen.getByTestId('settings-notifications-switch').props.value).toBe(false)
  expect(screen.queryByText('Indisponible sur cet appareil ou cette version de l’app.')).toBeNull()
  fireEvent.press(screen.getByTestId('notifications-retry'))
  await waitFor(() => expect(screen.getByTestId('settings-notifications-switch').props.value).toBe(true))
})

test('a failed disable keeps the confirmed enabled state and allows retry', async () => {
  jest.mocked(isPushEnabled).mockResolvedValue(true)
  jest.mocked(disablePush).mockRejectedValueOnce(new Error('unregistration failed'))
  renderSettings(NotificationsScreen)
  await waitFor(() => expect(screen.getByTestId('settings-notifications').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(screen.getByTestId('settings-notifications'))
  await waitFor(() => expect(screen.getByTestId('notifications-retry')).toBeTruthy())
  expect(screen.getByTestId('settings-notifications-switch').props.value).toBe(true)
  fireEvent.press(screen.getByTestId('notifications-retry'))
  await waitFor(() => expect(screen.getByTestId('settings-notifications-switch').props.value).toBe(false))
})

test('permission warnings are refreshed when returning from system settings', async () => {
  jest.mocked(pushPermissionMessage).mockResolvedValue('Notifications bloquées : autorise-les dans les réglages du téléphone.')
  renderSettings(NotificationsScreen)
  await waitFor(() => expect(screen.getByTestId('notifications-system-settings')).toBeTruthy())
  act(() => { focusManager.setFocused(false) })
  jest.mocked(pushPermissionMessage).mockResolvedValue(null)
  jest.mocked(isPushEnabled).mockResolvedValue(true)
  act(() => { focusManager.setFocused(true) })
  await waitFor(() => expect(screen.getByText('Réception activée sur cet appareil.')).toBeTruthy())
  await waitFor(() => expect(screen.queryByTestId('notifications-system-settings')).toBeNull())
  expect(screen.queryByText(/Notifications bloquées/)).toBeNull()
})

test('disabled overview cards describe the retained schedule instead of an active delivery', async () => {
  const connector = new FakeFridgeConnector()
  await connector.setReminderSettings({ enabled: false, checkupEnabled: false, checkupDay: 5 })
  renderSettings(NotificationsScreen, connector)
  await waitFor(() => expect(screen.getByText('Délai conservé : 2 jours avant la péremption.')).toBeTruthy())
  expect(screen.getByText('Jour conservé : vendredi.')).toBeTruthy()
})
