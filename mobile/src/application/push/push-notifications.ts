/**
 * Push notifications, opt-in from Réglages (cf. docs/adr/0018).
 *
 * `expo-notifications` is imported lazily, inside the functions: it is a native
 * module, so a top-level import would load it in the web build and in every
 * screen test that merely renders something depending on this file.
 *
 * Remote push needs a development build with an EAS project id — Expo Go
 * cannot receive it. Without one, `enablePush` answers `unavailable`.
 */
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { readSetting, writeSetting } from '../shared/app-storage.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

const ENABLED_KEY = 'push_enabled'
const TOKEN_KEY = 'push_token'

export type EnablePushResult = 'enabled' | 'denied' | 'unavailable'

let lastHandled: string | null = null

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android'

async function currentToken(): Promise<string | null> {
  const Notifications = await import('expo-notifications')
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return null
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Garde-manger',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data
  } catch {
    // Simulator, no Google services, no network: nothing to register.
    return null
  }
}

async function register(connector: FridgeConnector): Promise<boolean> {
  const token = await currentToken()
  if (!token) return false
  const result = await connector.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android')
  if (!result.ok) return false
  await writeSetting(TOKEN_KEY, token)
  return true
}

export async function isPushEnabled(): Promise<boolean> {
  return (await readSetting(ENABLED_KEY)) === '1'
}

/** Asks for the permission if needed, then registers this device. */
export async function enablePush(connector: FridgeConnector): Promise<EnablePushResult> {
  if (!isSupported) return 'unavailable'
  const Notifications = await import('expo-notifications')
  let { granted } = await Notifications.getPermissionsAsync()
  if (!granted) ({ granted } = await Notifications.requestPermissionsAsync())
  if (!granted) return 'denied'
  if (!(await register(connector))) return 'unavailable'
  await writeSetting(ENABLED_KEY, '1')
  return 'enabled'
}

/** Stops the pushes for this device. `keepPreference` = sign-out: the toggle stays on for the next login. */
export async function disablePush(
  connector: FridgeConnector,
  { keepPreference = false }: { keepPreference?: boolean } = {},
): Promise<void> {
  const token = await readSetting(TOKEN_KEY)
  if (token) await connector.unregisterPushToken(token)
  if (!keepPreference) await writeSetting(ENABLED_KEY, '0')
}

/** Tokens rotate: on launch, silently re-register a device that opted in. Never prompts. */
export async function syncPushToken(connector: FridgeConnector): Promise<void> {
  if (!isSupported || !(await isPushEnabled())) return
  const Notifications = await import('expo-notifications')
  if (!(await Notifications.getPermissionsAsync()).granted) return
  await register(connector)
}

/** Shows pushes that arrive while the app is open, and sends a tap to the screen it names. */
export async function listenToNotifications(open: (route: string) => void): Promise<() => void> {
  if (!isSupported) return () => {}
  const Notifications = await import('expo-notifications')
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
  // A tap that launched the app from a killed state fires before any listener exists:
  // it is only readable afterwards. `handled` keeps a re-mount from replaying it.
  const handle = (response: import('expo-notifications').NotificationResponse) => {
    const id = response.notification.request.identifier
    if (id === lastHandled) return
    lastHandled = id
    const route = response.notification.request.content.data?.route
    if (typeof route === 'string') open(route)
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(handle)
  const launched = await Notifications.getLastNotificationResponseAsync()
  if (launched) handle(launched)
  return () => subscription.remove()
}
