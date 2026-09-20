import { useEffect, useState } from 'react'
import { Linking, Pressable, Switch } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { BellIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { disablePush, enablePush, isPushEnabled } from '../../application/push/push-notifications.js'

/**
 * The notifications on/off row. A plain row, not a card: nothing opens from it, so
 * no surface, no chevron, no IdentityCard headline. The whole row
 * toggles (one 44pt+ target, one screen-reader `switch`); the Switch inside is
 * the visual state only.
 */
export function NotificationsRow({ palette }: { palette: SoftPalette }) {
  const connector = useConnector()
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    void isPushEnabled().then(setEnabled)
  }, [])

  async function toggle() {
    if (pending) return
    setPending(true)
    setNote(null)
    try {
      if (enabled) {
        await disablePush(connector)
        setEnabled(false)
        return
      }
      const result = await enablePush(connector)
      setEnabled(result === 'enabled')
      if (result === 'denied') {
        setNote('Autorise les notifications dans les réglages du téléphone.')
        void Linking.openSettings()
      }
      if (result === 'unavailable') setNote('Indisponible sur cet appareil ou cette version de l’app.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Pressable
      testID="settings-notifications"
      onPress={toggle}
      disabled={pending}
      accessibilityRole="switch"
      accessibilityLabel="Notifications"
      accessibilityHint="Produits qui expirent bientôt et analyses terminées"
      accessibilityState={{ checked: enabled, disabled: pending }}
      style={[pointerCursor, { alignSelf: 'stretch' }]}
    >
      <XStack width="100%" alignItems="center" justifyContent="space-between" gap="$3" minHeight={56} paddingLeft="$4">
        <YStack width={36} height={36} alignItems="center" justifyContent="center">
          <BellIcon size={20} color={palette.ink} />
        </YStack>
        <YStack flex={1} minWidth={0}>
          <Text fontSize={15} fontWeight="800" color={palette.ink}>
            Notifications
          </Text>
          <Text fontSize={13} fontWeight="500" color={note ? palette.expiredText : palette.inkSecondary} accessibilityLiveRegion="polite">
            {note ?? 'Produits qui expirent bientôt, analyses terminées.'}
          </Text>
        </YStack>
        <Switch
          testID="settings-notifications-switch"
          value={enabled}
          disabled={pending}
          style={{ alignSelf: 'center' }}
          trackColor={{ true: palette.freshText }}
          // The row is the control: keep the Switch out of the tap and the a11y tree.
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      </XStack>
    </Pressable>
  )
}
