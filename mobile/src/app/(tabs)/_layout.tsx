import { useTranslation } from '../../i18n/index.js'
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
  const { t } = useTranslation()
  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{t('shared.home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fridge">
        <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} />
        <NativeTabs.Trigger.Label>{t('fridge.pantry')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipes">
        <NativeTabs.Trigger.Icon sf="fork.knife" />
        <NativeTabs.Trigger.Label>{t('dashboard.recipes')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shopping-list">
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} />
        <NativeTabs.Trigger.Label>{t('dashboard.shopping')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan" role="search">
        <NativeTabs.Trigger.Icon sf="barcode.viewfinder" />
        <NativeTabs.Trigger.Label>{t('dashboard.scan')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

/** Android, web and iPad: hidden native bar, AppShell draws its own Sidebar or BlurView pill instead. */
function DefaultTabs() {
  const { t } = useTranslation()
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" options={{ title: t('shared.home') }} />
      <Tabs.Screen name="fridge" options={{ title: t('fridge.pantry') }} />
      <Tabs.Screen name="recipes" options={{ title: t('dashboard.recipes') }} />
      <Tabs.Screen name="shopping-list" options={{ title: t('shopping-list.shopping_list') }} />
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

  if (session.isPending || (session.isError && session.data === undefined)) return <BootSplash />
  if (!session.data) {
    if (hasSeenWelcome === null) return <BootSplash />
    return <Redirect href={hasSeenWelcome ? '/(auth)/sign-in' : '/welcome'} />
  }
  // A failed initial read establishes neither presence nor absence. Keep
  // the splash's retry available instead of mounting household queries.
  // Cached household data still lets existing members open the app offline.
  if (household.isPending || (household.isError && !household.data)) return <BootSplash />
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
