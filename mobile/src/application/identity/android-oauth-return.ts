/** Browser callbacks are consumed by Better Auth, not by app navigation. */
export const ANDROID_OAUTH_CALLBACK = 'gardemanger://oauth-return'

export function readAndroidOAuthReturn(path: string): { error: string | null; hasCookie: boolean } | null {
  try {
    const url = new URL(path, 'gardemanger://')
    if (url.protocol !== 'gardemanger:' || url.hostname !== 'oauth-return' || (url.pathname && url.pathname !== '/')) return null
    const error = url.searchParams.get('error')
    return {
      // Never retain arbitrary callback text, cookies or OAuth credentials.
      error: error === null ? null : /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(error) ? error : 'oauth_callback_failed',
      hasCookie: Boolean(url.searchParams.get('cookie')),
    }
  } catch {
    return null
  }
}
