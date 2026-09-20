import { Platform } from 'react-native'

/** expo-haptics has no web implementation; every call site goes through this. */
export function haptic(run: () => Promise<void>) {
  if (Platform.OS === 'web') return
  run().catch(() => {}) // best effort: a device without a haptic engine must not surface an error
}
