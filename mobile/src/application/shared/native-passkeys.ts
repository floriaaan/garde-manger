import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'

/** Expo Go and builds made before the passkey module was added have no bridge. */
export function nativePasskeysAvailable(): boolean {
  return Platform.OS === 'web' || requireOptionalNativeModule('BetterAuthReactNativePasskey') !== null
}
