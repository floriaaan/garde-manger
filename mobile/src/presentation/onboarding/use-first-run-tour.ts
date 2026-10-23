/** Opt-in at the household threshold, or explicitly replayed from Settings. */
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { clearSetting, readSetting, writeSetting } from '../../application/shared/app-storage.js'

const KEY = 'garde-manger.first-run-tour.armed'

/**
 * Await before navigating: the dashboard reads this key whenever it gains focus.
 */
export async function armFirstRunTour(enabled = true): Promise<void> {
  if (enabled) await writeSetting(KEY, '1')
  else await clearSetting(KEY)
}

export function useFirstRunTour(enabled: boolean): { show: boolean; dismiss: () => void } {
  // No prompt until the saved opt-in has been read.
  const [armed, setArmed] = useState<boolean | null>(null)

  // The dashboard stays mounted underneath Settings; replay must re-read on focus.
  useFocusEffect(useCallback(() => {
    let mounted = true
    readSetting(KEY).then((value) => {
      if (mounted) setArmed(value === '1')
    })
    return () => {
      mounted = false
    }
  }, []))

  const dismiss = useCallback(() => {
    // Optimistic: the tour closes on the tap, not on the write. Skipping is
    // respected until the member explicitly replays it from Settings.
    setArmed(false)
    clearSetting(KEY)
  }, [])

  return { show: enabled && armed === true, dismiss }
}
