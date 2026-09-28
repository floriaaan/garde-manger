import { router, useLocalSearchParams } from 'expo-router'
import { ServerChoiceScreen as ServerChoicePresentation } from '../presentation/onboarding/server-choice-screen.js'

/**
 * A route-root screen, same reason `welcome.tsx` is one — no session, no
 * tab, nothing to gate on but the same first-launch flag. Sits between
 * `/welcome` and the shared authentication screen: `welcome.tsx`'s
 * "Commencer"/"Passer" routes here, then opens the creation tab.
 *
 * Also reached from Réglages ("Changer de serveur"), which passes
 * `?next=sign-in` — that visitor already has an account on some server and
 * should land back on the connection tab.
 */
export default function ServerChoiceRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>()
  return (
    <ServerChoicePresentation
      onDone={() => router.replace(next === 'sign-in' ? '/(auth)/sign-in' : { pathname: '/(auth)/sign-in', params: { mode: 'sign-up' } })}
    />
  )
}
