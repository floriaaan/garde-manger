import { ANDROID_OAUTH_CALLBACK, readAndroidOAuthReturn } from './android-oauth-return.js'
import { redirectSystemPath } from '../../app/+native-intent.js'

test('Android OAuth returns are consumed without navigating or retaining credentials', () => {
  const path = `${ANDROID_OAUTH_CALLBACK}?cookie=secret&access_token=secret`
  expect(readAndroidOAuthReturn(path)).toEqual({ error: null, hasCookie: true })
  expect(redirectSystemPath({ path, initial: false })).toBeNull()
})

test('callback errors retain only a safe code', () => {
  expect(readAndroidOAuthReturn(`${ANDROID_OAUTH_CALLBACK}?error=account_not_linked&error_description=secret`))
    .toEqual({ error: 'account_not_linked', hasCookie: false })
  expect(readAndroidOAuthReturn(`${ANDROID_OAUTH_CALLBACK}?error=secret%20credentials`))
    .toEqual({ error: 'oauth_callback_failed', hasCookie: false })
})

test.each(['gardemanger://join?code=abc', 'gardemanger://reset-password?token=abc', 'https://oauth-return?cookie=secret', 'gardemanger://oauth-return/other'])('unrelated deep links remain navigable: %s', (path) => {
  expect(readAndroidOAuthReturn(path)).toBeNull()
  expect(redirectSystemPath({ path, initial: false })).toBe(path)
})
