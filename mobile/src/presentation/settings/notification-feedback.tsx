import { useTranslation } from '../../i18n/index.js'
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
  const { t } = useTranslation()
  return editor.failed ? <PillButton testID="reminder-save-retry" label={t('dashboard.try_again')}
      accessibilityLabel={t('settings.try_saving_the_reminder_again')} palette={palette}
      tone="quiet" disabled={editor.pending} onPress={editor.retry} /> : null
}

export function DeviceNotificationStatus({ palette }: { palette: SoftPalette }) {
  const { t } = useTranslation()
  const status = useDeviceNotificationsQuery()
  return <YStack gap="$2">
    <NotificationFeedback palette={palette} error={status.isError} message={
      status.isPending ? t('settings.checking_notifications_on_this_device')
        : status.isError ? t('settings.couldn_t_check_notifications_on_this_device')
        : status.data ? t('settings.notifications_enabled_on_this_device')
        : t('settings.notifications_disabled_on_this_device_household_reminders_can_still_be')
    } />
    {status.isError ? <PillButton label={t('dashboard.try_again')} palette={palette} tone="quiet"
      disabled={status.isFetching} onPress={() => { void status.refetch() }} />
      : !status.isPending && !status.data ? <PillButton testID="device-notifications-settings"
        label={t('settings.manage_notifications_on_this_device')} palette={palette} tone="quiet"
        onPress={() => router.push('/notifications')} /> : null}
  </YStack>
}
