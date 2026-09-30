/** Device-local entry flag: new visitors start at sign-up, returning visitors at sign-in. */
import { useEffect, useState } from 'react'
import { clearSetting, readSetting, writeSetting } from '../../application/shared/app-storage.js'

const KEY = 'garde-manger.welcome.seen'

export async function markWelcomeSeen(): Promise<void> {
  await writeSetting(KEY, '1')
}

/**
 * Dev-only escape hatch (Réglages' Debug menu): clears the flag so the next
 * visit to "/" redirects into the welcome entry again, without reinstalling the
 * app. Production ships no button that calls this — the flag exists so the
 * welcome entry shows exactly once per device, and a user-facing reset would
 * contradict that on the first tap.
 */
export async function resetWelcomeSeen(): Promise<void> {
  await clearSetting(KEY)
}

/**
 * `null` while the flag is being read — the `(tabs)` gate renders nothing
 * for that one tick, the same "don't decide on a missing answer" rule
 * `session`/`household` already follow there, rather than flashing the
 * welcome entry at a returning member for the length of one keychain read.
 */
export function useHasSeenWelcome(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    readSetting(KEY).then((value) => {
      if (mounted) setSeen(value === '1')
    })
    return () => {
      mounted = false
    }
  }, [])

  return seen
}
