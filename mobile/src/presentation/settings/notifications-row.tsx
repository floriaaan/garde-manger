import { useEffect, useRef, useState } from 'react'
import { focusManager, useQuery, useQueryClient } from '@tanstack/react-query'
import { Linking, Platform, Pressable, Switch } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { pointerCursor } from '../shared/hover.js'
import { BellIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { disablePush, enablePush, pushPermissionMessage } from '../../application/push/push-notifications.js'
import { DEVICE_NOTIFICATIONS_KEY, useDeviceNotificationsQuery } from '../../application/push/device-notifications.query.js'
import { NotificationFeedback } from './notification-feedback.js'
import { showToast } from '../../application/shared/toast.js'

/** One full-row switch; its inner Switch is only the visual state. */
export function NotificationsRow({ palette }: { palette: SoftPalette }) {
  const connector = useConnector()
  const status = useDeviceNotificationsQuery()
  const queryClient = useQueryClient()
  const enabled = status.data === true
  const [pending, setPending] = useState(false)
  const toggling = useRef(false)
  const [note, setNote] = useState<string | null>(null)
  const [needsSettings, setNeedsSettings] = useState(false)
  const [toggleFailed, setToggleFailed] = useState(false)

  const details = useQuery({
    queryKey: ['device-notification-permissions'],
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const [message, key] = await Promise.all([
        pushPermissionMessage(),
        Platform.OS === 'web' ? connector.getWebPushPublicKey() : Promise.resolve(null),
      ])
      return {
        key,
        note: Platform.OS === 'web' && !key ? 'Push Web non configuré sur ce serveur.' : message,
        needsSettings: Platform.OS !== 'web' && !!message?.startsWith('Notifications bloquées'),
      }
    },
  })
  const loading = details.isPending
  const loadFailed = details.isError
  const webKey = details.data?.key ?? null

  useEffect(() => {
    return focusManager.subscribe((focused) => {
      if (focused) {
        setNote(null)
        setNeedsSettings(false)
      }
    })
  }, [])

  async function toggle() {
    if (toggling.current) return
    toggling.current = true
    setPending(true)
    setToggleFailed(false)
    setNeedsSettings(false)
    setNote(null)
    try {
      showToast(enabled ? 'Désactivation…' : 'Activation…', 'loading')
      if (enabled) {
        await disablePush(connector)
        queryClient.setQueryData(DEVICE_NOTIFICATIONS_KEY, false)
        void details.refetch()
        showToast('Notifications désactivées sur cet appareil.', 'success')
        return
      }
      if (Platform.OS === 'web' && !webKey) {
        showToast('Notifications non configurées sur ce serveur.', 'error')
        setNote('Push Web non configuré sur ce serveur.')
        return
      }
      const result = await enablePush(connector, webKey ?? undefined)
      if (result === 'failed') {
        setToggleFailed(true)
        showToast('Impossible d’activer les notifications pour le moment.', 'error', {
          label: 'Réessayer', onPress: () => { void toggle() },
        })
        return
      }
      queryClient.setQueryData(DEVICE_NOTIFICATIONS_KEY, result === 'enabled')
      if (result === 'enabled') {
        void details.refetch()
        showToast('Notifications activées sur cet appareil.', 'success')
      }
      if (result === 'denied') {
        showToast('Notifications non autorisées.', 'error')
        setNeedsSettings(Platform.OS !== 'web')
        setNote(Platform.OS === 'web'
          ? 'Autorise les notifications pour ce site dans les réglages du navigateur.'
          : 'Autorise les notifications dans les réglages du téléphone.')
      }
      if (result === 'unavailable') {
        showToast('Notifications indisponibles dans cet environnement.', 'error')
        setNote(Platform.OS === 'web'
          ? 'Pour recevoir les notifications, utilise une connexion HTTPS. Sur iPhone, ajoute l’app à l’écran d’accueil.'
          : 'Indisponible sur cet appareil ou cette version de l’app.')
      }
    } catch {
      setToggleFailed(true)
      showToast('Impossible de modifier les notifications.', 'error', {
        label: 'Réessayer', onPress: () => { void toggle() },
      })
    } finally {
      toggling.current = false
      setPending(false)
    }
  }

  const disabled = pending || loading || loadFailed || status.isPending || status.isError
  const deviceMessage = status.isError ? 'Impossible de vérifier les notifications sur cet appareil.'
    : status.isPending || loading ? 'Vérification des notifications sur cet appareil…'
    : enabled ? 'Réception activée sur cet appareil.' : 'Notifications coupées sur cet appareil.'

  return (
    <YStack gap="$2">
      <Pressable testID="settings-notifications" onPress={() => { void toggle() }} disabled={disabled}
        accessibilityRole="switch" accessibilityLabel="Activer toutes les notifications sur cet appareil"
        accessibilityHint="Active ou coupe toutes les notifications sur cet appareil"
        accessibilityState={{ checked: enabled, disabled, busy: pending || loading || status.isPending }}
        style={[pointerCursor, { alignSelf: 'stretch' }]}>
        <XStack width="100%" alignItems="center" justifyContent="space-between" gap="$3" minHeight={56} paddingLeft="$4">
          <YStack width={36} height={36} alignItems="center" justifyContent="center">
            <BellIcon size={20} color={palette.ink} />
          </YStack>
          <Text flex={1} minWidth={0} fontSize={15} lineHeight={22} fontWeight="800" color={palette.ink}>
            Activer toutes les notifications
          </Text>
          <XStack minHeight={48} flexShrink={0} alignItems="center" pointerEvents="none"
            accessible={false} importantForAccessibility="no-hide-descendants">
            <Switch testID="settings-notifications-switch" value={enabled}
              style={{ alignSelf: 'center', margin: 0 }} trackColor={{ true: palette.freshText }}
              pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" />
          </XStack>
        </XStack>
      </Pressable>
      <NotificationFeedback message={deviceMessage} error={status.isError} palette={palette} />
      <NotificationFeedback message={note ?? (loadFailed ? 'Impossible de préparer les notifications. Réessaie.' : details.data?.note ?? null)} error palette={palette} />
      {status.isError || loadFailed || toggleFailed ? <PillButton testID="notifications-retry"
        label="Réessayer" palette={palette} tone="quiet" disabled={pending || loading || status.isFetching || details.isFetching}
        onPress={() => {
          if (status.isError || loadFailed) { void status.refetch(); void details.refetch() }
          else void toggle()
        }} /> : null}
      {!pending && (needsSettings || details.data?.needsSettings) ? <PillButton testID="notifications-system-settings" label="Ouvrir les réglages"
        palette={palette} tone="quiet" onPress={() => {
          void Linking.openSettings().catch(() => showToast('Impossible d’ouvrir les réglages. Ouvre-les depuis ton téléphone.', 'error'))
        }} /> : null}
    </YStack>
  )
}
