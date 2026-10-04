import { AppState, Platform } from 'react-native'
import { focusManager } from '@tanstack/react-query'

/**
 * TanStack's `focusManager` only knows the browser's visibility events; on a
 * phone "the app came back to the foreground" is `AppState`. Wiring it makes
 * session and jobs queries revalidate on return. Installed at the root so a
 * failed cold-start session can retry even before protected screens mount.
 */
export function wireFocusManager(): () => void {
  if (Platform.OS === 'web') return () => {}
  focusManager.setFocused(AppState.currentState == null ? undefined : AppState.currentState === 'active')
  const subscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active')
  })
  return () => subscription.remove()
}
