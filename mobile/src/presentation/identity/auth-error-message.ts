import { t } from '../../i18n/index.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { Result } from '../../domain/shared/result.js'

/**
 * A mutation fails two different ways — the request threw (offline, an
 * unreachable server), or the server answered with a domain error — and a
 * form that shows the same flat string for both hides which one happened,
 * on the one screen where "was my password wrong, or is my connection
 * down" is the whole question the user needs answered. Mirrors
 * `threshold-screen.tsx`'s own `errorMessage`, generalized for the auth
 * forms and `AuthMethodFooter`'s social sign-in, which had all been
 * carrying one bare literal each instead.
 */
export function authErrorMessage(thrown: unknown, data: Result<unknown, ApiError> | undefined, fallback: string): string | null {
  if (thrown) return t('identity.check_your_connection', { value1: fallback })
  if (data && !data.ok) return data.error.message
  return null
}
