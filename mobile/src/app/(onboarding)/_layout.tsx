import { Redirect, Stack } from 'expo-router'
import { BootSplash } from '../../presentation/shared/boot-splash.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'

/**
 * The mirror of `(auth)/_layout.tsx`, one step further in.
 *
 * `(auth)` bounces you out when a session exists; this group bounces you out
 * when a *foyer* exists, and back to sign-in when the session does not. The
 * two gates are deliberately symmetric, and the pair of them is why every
 * screen inside `(tabs)` can now assume a household: PRODUCT.md's first
 * principle is that the foyer is the unit of truth, and an account floating
 * outside one had no screen that could honestly render.
 *
 * Neither query redirects while it is pending. A gate that decides on a
 * missing answer sends a signed-in member of a real foyer to the onboarding
 * for the length of one fetch, which is a flash of the wrong app.
 */
export default function OnboardingLayout() {
  const session = useSessionQuery()
  const household = useHouseholdQuery()

  if (session.isPending) return <BootSplash />
  if (!session.data) return <Redirect href="/(auth)/sign-in" />
  if (household.isPending) return <BootSplash />
  if (household.data) return <Redirect href="/(tabs)" />
  // A failed read lands here too, and the threshold is the right place for it:
  // both of its actions answer `already_in_household` by re-reading, so
  // someone who does have a foyer is carried back out by the gate rather than
  // stranded on an error screen with nothing to press.

  return <Stack screenOptions={{ headerShown: false }} />
}
