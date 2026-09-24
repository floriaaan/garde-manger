export const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 10_000

/** No retry fixes a missing credential or a spent quota — they fail on the first attempt. */
const FATAL: readonly string[] = [
  'provider_not_configured',
  'ai_quota_exceeded',
  'unsupported_format',
]

/** `null` = give up. Otherwise the date of the next attempt (10 s, then 20 s, then give up). */
export function nextAttemptAt(errorType: string, attempts: number, now: Date): Date | null {
  if (FATAL.includes(errorType) || attempts >= MAX_ATTEMPTS) return null
  return new Date(now.getTime() + BASE_DELAY_MS * 2 ** (attempts - 1))
}

export function isFatal(errorType: string): boolean {
  return FATAL.includes(errorType)
}
