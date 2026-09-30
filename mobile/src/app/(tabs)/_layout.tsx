import { Redirect, Tabs } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useHasSeenWelcome } from '../../presentation/welcome/use-welcome-seen.js'
import { JobHost } from '../../presentation/job/job-host.js'
import { ActiveJobPill } from '../../presentation/job/active-job-pill.js'
import { PushHost } from '../../presentation/push/push-host.js'
import { BootSplash } from '../../presentation/shared/boot-splash.js'
import { USES_NATIVE_TABS } from '../../presentation/shared/app-shell.js'

/**
 * iPhone: real `NativeTabs` — Liquid Glass on iOS 26+, standard native bar
 * below that. The `scan` trigger uses `role="search"`, which iOS renders
 * as a separate, floating pill on the trailing edge of the bar — see
 * `(tabs)/scan.tsx` for why it's a route rather than a plain button.
 */
function IosTabs() {
  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fridge">
        <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} />
        <NativeTabs.Trigger.Label>Garde-manger</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipes">
        <NativeTabs.Trigger.Icon sf="fork.knife" />
        <NativeTabs.Trigger.Label>Recettes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shopping-list">
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} />
        <NativeTabs.Trigger.Label>Courses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan" role="search">
        <NativeTabs.Trigger.Icon sf="barcode.viewfinder" />
        <NativeTabs.Trigger.Label>Scanner</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

/** Android, web and iPad: hidden native bar, AppShell draws its own Sidebar or BlurView pill instead. */
function DefaultTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="fridge" options={{ title: 'Garde-manger' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recettes' }} />
      <Tabs.Screen name="shopping-list" options={{ title: 'Liste de courses' }} />
    </Tabs>
  )
}

/** Existing sessions bypass welcome; signed-out newcomers start at sign-up.
 * A household read must succeed before absence can trigger onboarding.
 */
export default function TabsLayout() {
  const hasSeenWelcome = useHasSeenWelcome()
  const session = useSessionQuery()
  const household = useHouseholdQuery()

  if (session.isPending) return <BootSplash />
  if (!session.data) {
    if (hasSeenWelcome === null) return <BootSplash />
    return <Redirect href={hasSeenWelcome ? '/(auth)/sign-in' : '/welcome'} />
  }
  if (household.isPending) return <BootSplash />
  // Success-and-empty, never merely "no data": a failed read is not a missing
  // foyer, and redirecting on one would answer an unreachable server by
  // telling a member their household does not exist. On an error the tabs
  // render, and each screen's own `isError` branch says what actually
  // happened — the rule DESIGN.md states for every screen that reads shared
  // household state.
  if (household.isSuccess && !household.data) return <Redirect href="/(onboarding)" />

  return (
    <>
      {USES_NATIVE_TABS ? <IosTabs /> : <DefaultTabs />}
      <JobHost />
      <PushHost />
      <ActiveJobPill />
    </>
  )
}
