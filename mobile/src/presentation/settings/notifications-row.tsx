import { useEffect, useState } from 'react'
import { Linking, Platform, Pressable, Switch } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { BellIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { disablePush, enablePush, isPushEnabled, pushPermissionMessage } from '../../application/push/push-notifications.js'

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
  const [webKey, setWebKey] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    void isPushEnabled().then(setEnabled)
    void pushPermissionMessage().then(setNote)
    if (Platform.OS === 'web') {
      void connector.getWebPushPublicKey().then((key) => {
        setWebKey(key)
        if (!key) setNote('Push Web non configuré sur ce serveur.')
      })
    }
  }, [connector])

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
      if (Platform.OS === 'web' && webKey === null) {
        setNote('Push Web non configuré sur ce serveur.')
        return
      }
      const result = await enablePush(connector, webKey ?? undefined)
      setEnabled(result === 'enabled')
      if (result === 'denied') {
        setNote(Platform.OS === 'web'
          ? 'Autorise les notifications pour ce site dans les réglages du navigateur.'
          : 'Autorise les notifications dans les réglages du téléphone.')
        if (Platform.OS !== 'web') void Linking.openSettings()
      }
      if (result === 'unavailable') setNote(Platform.OS === 'web'
        ? 'Push Web indisponible : utilise HTTPS, installe l’app sur l’écran d’accueil sur iPhone, ou contacte l’administrateur du serveur.'
        : 'Indisponible sur cet appareil ou cette version de l’app.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Pressable
      testID="settings-notifications"
      onPress={toggle}
      disabled={pending || (Platform.OS === 'web' && webKey === undefined)}
      accessibilityRole="switch"
      accessibilityLabel="Notifications"
      accessibilityHint={Platform.OS === 'web' ? 'Produits qui expirent bientôt' : 'Produits qui expirent bientôt et analyses terminées'}
      accessibilityState={{ checked: enabled, disabled: pending || (Platform.OS === 'web' && webKey === undefined) }}
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
            {note ?? (Platform.OS === 'web' ? 'Produits qui expirent bientôt.' : 'Produits qui expirent bientôt, analyses terminées.')}
          </Text>
        </YStack>
        <Switch
          testID="settings-notifications-switch"
          value={enabled}
          disabled={pending || (Platform.OS === 'web' && webKey === undefined)}
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
