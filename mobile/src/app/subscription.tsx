import { SubscriptionScreen } from '../presentation/settings/subscription-screen.js'
import { AuthEntryScreen } from '../presentation/identity/auth-entry-screen.js'
import { BootSplash } from '../presentation/shared/boot-splash.js'
import { useSessionQuery } from '../application/identity/session.query.js'

export default function SubscriptionRoute() {
  const session = useSessionQuery()
  if (session.isPending || (session.isError && session.data === undefined)) return <BootSplash />
  if (!session.data) return <AuthEntryScreen successHref="/subscription" />
  return <SubscriptionScreen />
}
