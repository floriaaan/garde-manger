import { Platform } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useHasSeenWelcome } from '../../presentation/welcome/use-welcome-seen.js'
import { JobHost } from '../../presentation/job/job-host.js'
import { ActiveJobPill } from '../../presentation/job/active-job-pill.js'
import { BootSplash } from '../../presentation/shared/boot-splash.js'

/**
 * iOS: real `NativeTabs` — Liquid Glass on iOS 26+, standard native bar
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

/** Android/web: unchanged — hidden native bar, AppShell draws its own BlurView pill instead. */
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

/**
 * Three gates, in order: the welcome carousel, then a session, then a foyer.
 *
 * The welcome gate runs first because "/" (this layout — `(tabs)/index.tsx`
 * is a group-index route, so it's what a cold launch actually lands on) is
 * the one place every fresh install passes through before it has a session
 * to gate on. `useHasSeenWelcome` returns `null` while the flag is being
 * read and this gate renders nothing for that tick, same as the two below
 * it — deciding "not seen" on a missing answer would flash the carousel at
 * a returning member for the length of one keychain read.
 *
 * The other two: a session, then a foyer. The second is what lets every
 * screen below assume `household` exists. Before it, an account created
 * seconds ago landed on a dashboard whose household name fell back to "Ton
 * foyer", whose Foyer screen said "Tu n'appartiens à aucun foyer", and which
 * offered nowhere to fix that — the create and join endpoints have shipped
 * since phase 1 and the app called neither.
 *
 * `household.isPending` returns null rather than redirecting: the query is
 * cold on every launch, and a gate that treats "not answered yet" as "no
 * foyer" throws a returning member into the onboarding for the length of one
 * fetch.
 */
export default function TabsLayout() {
  const hasSeenWelcome = useHasSeenWelcome()
  const session = useSessionQuery()
  const household = useHouseholdQuery()

  if (hasSeenWelcome === null) return <BootSplash />
  if (!hasSeenWelcome) return <Redirect href="/welcome" />
  if (session.isPending) return <BootSplash />
  if (!session.data) return <Redirect href="/(auth)/sign-in" />
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
      {Platform.OS === 'ios' ? <IosTabs /> : <DefaultTabs />}
      <JobHost />
      <ActiveJobPill />
    </>
  )
}
