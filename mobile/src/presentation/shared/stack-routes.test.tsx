/**
 * Regression test for a dead entrance, not a routing unit test.
 *
 * `Réglages`, `Foyer` and `Historique des tickets` used to be files inside
 * `src/app/(tabs)/`. On iOS that group renders through `NativeTabs`, which
 * only routes to the triggers the layout declares — so `router.push('/settings')`
 * resolved to nothing at all and the app's only entrance to Réglages was dead.
 * Marking them `hidden` is not the fix either: expo-router documents (and this
 * test's first version confirmed) that a hidden tab "cannot be navigated to in
 * any way".
 *
 * The fix is structural: they are pushed stack screens, so they live at the root
 * next to the tab group. This test pins that they stay reachable.
 */
import { renderRouter, act, waitFor } from 'expo-router/testing-library'
import { router, Stack } from 'expo-router'
import { Text } from 'react-native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'

function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fridge">
        <NativeTabs.Trigger.Label>Frigo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

const tabGroup = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': () => <Text>Accueil</Text>,
  '(tabs)/fridge/index': () => <Text>Frigo</Text>,
}

test('a stack screen at the root is reachable from a tab', async () => {
  const app = renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      ...tabGroup,
      settings: () => <Text>Réglages</Text>,
      account: () => <Text>Mon compte</Text>,
      household: () => <Text>Foyer</Text>,
      'receipts/index': () => <Text>Tickets</Text>,
      'home-assistant': () => <Text>Home Assistant</Text>,
      scanner: () => <Text>Scanner</Text>,
    },
    { initialUrl: '/' },
  )

  const go = async (action: () => void, expected: string) => {
    await act(async () => action())
    await waitFor(() => expect(app.getPathname()).toBe(expected))
  }

  await go(() => router.push('/settings'), '/settings')
  await go(() => router.push('/account'), '/account')
  await go(() => router.back(), '/settings')
  await go(() => router.push('/household'), '/household')
  await go(() => router.back(), '/settings')
  await go(() => router.push('/receipts'), '/receipts')
  await go(() => router.push('/home-assistant'), '/home-assistant')
  await go(() => router.push('/scanner'), '/scanner')
})
