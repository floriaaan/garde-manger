import { useEffect } from 'react'
import { BootSplash } from '../presentation/shared/boot-splash.js'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { parseInviteCode } from '../presentation/onboarding/join-link.js'
import { rememberInviteCode } from '../presentation/onboarding/pending-invite.js'
import { useSessionQuery } from '../application/identity/session.query.js'

/**
 * `gardemanger://join?code=K4Q2M7XP` lands here.
 *
 * The route owns one decision and then gets out of the way: is there an
 * account yet? With one, the code rides straight into the threshold as a
 * parameter. Without one, it is written to storage first — the sign-up detour
 * can take a browser round trip through PocketID and come back through a cold
 * start, and a route parameter does not survive that. The threshold picks it
 * up on the other side.
 *
 * A malformed or missing code is not an error worth a screen: the threshold
 * simply opens with empty cells, which is where that person was going anyway.
 */
export default function JoinDeepLink() {
  const session = useSessionQuery()
  const { code } = useLocalSearchParams<{ code?: string }>()
  const parsed = parseInviteCode(code)
  const signedIn = Boolean(session.data)

  // Not awaited, and it does not need to be: the code is read back on the far
  // side of a whole sign-up, which is minutes of typing and possibly a browser
  // round trip. Holding the redirect until a keychain write settles would put
  // a blank screen in front of someone who tapped a link.
  useEffect(() => {
    if (session.isPending || session.isError || signedIn || !parsed) return
    rememberInviteCode(parsed)
  }, [session.isPending, session.isError, signedIn, parsed])

  if (session.isPending || (session.isError && session.data === undefined)) return <BootSplash />
  if (!signedIn) return <Redirect href={{ pathname: '/(auth)/sign-in', params: { mode: 'sign-up' } }} />
  return <Redirect href={parsed ? { pathname: '/(onboarding)', params: { code: parsed } } : '/(onboarding)'} />
}
