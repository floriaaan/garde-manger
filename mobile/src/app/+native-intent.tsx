import { readAndroidOAuthReturn } from '../application/identity/android-oauth-return.js'

// The share extension wakes the app with a dataUrl URL. Its payload is read
// by useShareIntent in _layout; Expo Router must not try to render it as a page.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // Keep the sign-in screen mounted while the browser plugin persists the
  // cookie and verifies the session. Routing this URL loses mutation errors.
  if (readAndroidOAuthReturn(path)) return null
  if (/^(?:gardemanger:\/\/)?dataurl=/i.test(path.replace(/^\//, ''))) return '/'
  return path
}
