import { AppState, Platform } from 'react-native'
import { focusManager } from '@tanstack/react-query'

/**
 * TanStack's `focusManager` only knows the browser's visibility events; on a
 * phone "the app came back to the foreground" is `AppState`. Wiring it makes
 * the jobs query refetch on return, which is how a job that finished while the
 * app slept shows up without waiting for the next poll.
 */
export function wireFocusManager(): () => void {
  if (Platform.OS === 'web') return () => {}
  const subscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active')
  })
  return () => subscription.remove()
}
