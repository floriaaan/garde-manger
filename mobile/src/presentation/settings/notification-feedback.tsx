import { useEffect } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useDeviceNotificationsQuery } from '../../application/push/device-notifications.query.js'
import type { useReminderSettingsEditor } from '../../application/settings/reminder-settings-editor.js'

export function NotificationFeedback({ message, error = false, palette }: {
  message: string | null
  error?: boolean
  palette: SoftPalette
}) {
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message)
  }, [message])
  return message ? <Text fontSize={13} color={error ? palette.expiredText : palette.inkSecondary}
    accessibilityLiveRegion="polite">{message}</Text> : null
}

export function ReminderSaveFeedback({ editor, palette }: {
  editor: ReturnType<typeof useReminderSettingsEditor>
  palette: SoftPalette
}) {
  return editor.failed ? <PillButton testID="reminder-save-retry" label="Réessayer"
      accessibilityLabel="Réessayer d’enregistrer le rappel" palette={palette}
      tone="quiet" disabled={editor.pending} onPress={editor.retry} /> : null
}

export function DeviceNotificationStatus({ palette }: { palette: SoftPalette }) {
  const status = useDeviceNotificationsQuery()
  return <YStack gap="$2">
    <NotificationFeedback palette={palette} error={status.isError} message={
      status.isPending ? 'Vérification des notifications sur cet appareil…'
        : status.isError ? 'Impossible de vérifier les notifications sur cet appareil.'
        : status.data ? 'Réception activée sur cet appareil.'
        : 'Notifications coupées sur cet appareil. Les rappels du foyer restent configurables.'
    } />
    {status.isError ? <PillButton label="Réessayer" palette={palette} tone="quiet"
      disabled={status.isFetching} onPress={() => { void status.refetch() }} />
      : !status.isPending && !status.data ? <PillButton testID="device-notifications-settings"
        label="Gérer la réception sur cet appareil" palette={palette} tone="quiet"
        onPress={() => router.push('/notifications')} /> : null}
  </YStack>
}
