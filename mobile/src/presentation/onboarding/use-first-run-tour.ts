/**
 * The tour belongs to the threshold, not to the app's first launch.
 *
 * The obvious implementation — "show it until a `seen` flag is set" — shows it
 * to everybody exactly once, including a foyer of four who have been using
 * this app for months and just installed an update. A spotlight explaining
 * "voici tes recettes" over a garde-manger holding forty products is not an
 * onboarding, it is an interruption.
 *
 * So the flag is written *forward* instead: crossing the threshold arms the
 * tour, and the dashboard is where it goes off. Nobody who did not just create
 * or join a foyer on this device ever sees it, and the direction's own
 * sequence — the seuil, then the house — is the thing the storage key encodes.
 *
 * Armed on the device rather than the account, because there is no endpoint to
 * hang it on and inventing one for four beats would put a migration in front
 * of a tooltip.
 */
import { useCallback, useEffect, useState } from 'react'
import { clearSetting, readSetting, writeSetting } from '../../application/shared/app-storage.js'

const KEY = 'garde-manger.first-run-tour.armed'

/**
 * Awaited by the threshold before it navigates: the dashboard reads this key
 * on mount, and a write still in flight is a tour that silently never runs.
 */
export async function armFirstRunTour(enabled = true): Promise<void> {
  if (enabled) await writeSetting(KEY, '1')
  else await clearSetting(KEY)
}

export function useFirstRunTour(enabled: boolean): { show: boolean; dismiss: () => void } {
  // `null` while the flag is being read. The dashboard renders nothing at all
  // during that read: a spotlight that appears a beat after the screen settles
  // reads as a glitch, and one that flashes and vanishes reads as a bug.
  const [armed, setArmed] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    readSetting(KEY).then((value) => {
      if (mounted) setArmed(value === '1')
    })
    return () => {
      mounted = false
    }
  }, [])

  const dismiss = useCallback(() => {
    // Optimistic: the tour closes on the tap, not on the write. Skipping is
    // permanent — an onboarding that comes back is a punishment for having
    // dismissed it.
    setArmed(false)
    clearSetting(KEY)
  }, [])

  return { show: enabled && armed === true, dismiss }
}
