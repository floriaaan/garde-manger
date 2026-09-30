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
import type { WebPushSubscription } from '../../domain/settings/reminder-settings.js'

const ENABLED_KEY = 'push_enabled'
const TOKEN_KEY = 'push_token'

export type EnablePushResult = 'enabled' | 'denied' | 'unavailable'

let lastHandled: string | null = null

/**
 * Expo Go on Android dropped the whole push surface in SDK 53 — the module
 * still loads, but `setNotificationHandler`, `addNotificationResponseReceivedListener`
 * and friends are simply missing, so calling them throws "undefined is not a
 * function" rather than failing politely. There is no capability flag to read;
 * the execution environment is the only thing that tells Expo Go apart from a
 * development or store build, where the very same code works.
 */
const isExpoGoAndroid = Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient'

const isSupported = (Platform.OS === 'ios' || Platform.OS === 'android') && !isExpoGoAndroid

function webSupported(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.isSecureContext &&
    'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

function vapidKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index)
  return bytes
}

async function webSubscription(): Promise<PushSubscription | null> {
  if (!webSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
  return (await registration?.pushManager.getSubscription()) ?? null
}

async function registerWeb(connector: FridgeConnector, prompt: boolean, readyKey?: string): Promise<EnablePushResult> {
  if (!webSupported()) return 'unavailable'
  if (Notification.permission !== 'granted') {
    if (!prompt || (await Notification.requestPermission()) !== 'granted') return 'denied'
  }
  const publicKey = readyKey ?? await connector.getWebPushPublicKey()
  if (!publicKey) return 'unavailable'
  try {
    const registration = await navigator.serviceWorker.register('/push-sw.js')
    const subscription = (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(publicKey) }))
    const json = subscription.toJSON()
    if (!json.keys?.p256dh || !json.keys.auth) return 'unavailable'
    const payload: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }
    if (!(await connector.registerWebPush(payload)).ok) return 'unavailable'
    await writeSetting(ENABLED_KEY, '1')
    return 'enabled'
  } catch {
    return 'unavailable'
  }
}

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
  if ((await readSetting(ENABLED_KEY)) !== '1') return false
  if (Platform.OS === 'web') return webSupported() && Notification.permission === 'granted'
  if (!isSupported) return false
  const Notifications = await import('expo-notifications')
  return (await Notifications.getPermissionsAsync()).granted
}

export async function pushPermissionMessage(): Promise<string | null> {
  if ((await readSetting(ENABLED_KEY)) !== '1') return null
  if (Platform.OS === 'web') {
    if (!webSupported()) return 'Push Web indisponible : HTTPS est requis ; sur iPhone, ajoute le site à l’écran d’accueil.'
    return Notification.permission === 'denied'
      ? 'Notifications bloquées pour ce site : modifie les permissions du navigateur.'
      : null
  }
  if (!isSupported) return 'Notifications indisponibles sur cette version de l’app.'
  const Notifications = await import('expo-notifications')
  const permission = await Notifications.getPermissionsAsync()
  return !permission.granted && !permission.canAskAgain
    ? 'Notifications bloquées : autorise-les dans les réglages du téléphone.'
    : null
}

/** Asks for the permission if needed, then registers this device. */
export async function enablePush(connector: FridgeConnector, webPublicKey?: string): Promise<EnablePushResult> {
  if (Platform.OS === 'web') return registerWeb(connector, true, webPublicKey)
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
  if (Platform.OS === 'web') {
    const subscription = await webSubscription()
    if (subscription) {
      await connector.unregisterWebPush(subscription.endpoint)
      await subscription.unsubscribe()
    }
    if (!keepPreference) await writeSetting(ENABLED_KEY, '0')
    return
  }
  const token = await readSetting(TOKEN_KEY)
  if (token) await connector.unregisterPushToken(token)
  if (!keepPreference) await writeSetting(ENABLED_KEY, '0')
}

/** Tokens rotate: on launch, silently re-register a device that opted in. Never prompts. */
export async function syncPushToken(connector: FridgeConnector): Promise<void> {
  if (Platform.OS === 'web') {
    if ((await readSetting(ENABLED_KEY)) === '1' && webSupported() && Notification.permission === 'granted') {
      await registerWeb(connector, false)
    }
    return
  }
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
