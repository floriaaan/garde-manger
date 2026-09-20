import { router } from 'expo-router'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { HouseholdDashboard } from '../../presentation/dashboard/household-dashboard.js'
import type { ExpiryWindow } from '../../presentation/dashboard/product-status.js'

export default function HomeScreen() {
  const session = useSessionQuery()

  return (
    <HouseholdDashboard
      userName={session.data?.user.name ?? ''}
      onOpenRecettes={() => router.push('/(tabs)/recipes')}
      onOpenCourses={() => router.push('/(tabs)/shopping-list')}
      // The stat cards open the cabinet on what they just counted — see
      // `(tabs)/fridge/index.tsx`, which turns `status` back into a filter.
      onOpenFridge={(window?: ExpiryWindow) =>
        router.navigate(window ? { pathname: '/(tabs)/fridge', params: { status: window } } : '/(tabs)/fridge')
      }
      onOpenProduct={(productId) => router.navigate({ pathname: '/(tabs)/fridge/[id]', params: { id: productId } })}
      onAddProduct={() => router.navigate('/(tabs)/fridge/new')}
      onOpenStats={() => router.push('/stats')}
      onOpenSettings={() => router.push('/settings')}
      onOpenTasks={() => router.push('/tasks')}
      onOpenReceipts={() => router.push('/receipts')}
      onOpenHousehold={() => router.push('/household')}
    />
  )
}
