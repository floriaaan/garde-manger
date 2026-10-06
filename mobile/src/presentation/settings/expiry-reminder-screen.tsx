import { t, useTranslation } from '../../i18n/index.js'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { RadioCard } from '../shared/radio-card.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { BellIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { NotificationPreferenceRow } from './notification-preference-row.js'
import { useReminderSettingsEditor } from '../../application/settings/reminder-settings-editor.js'
import { DeviceNotificationStatus, ReminderSaveFeedback } from './notification-feedback.js'
import { PillButton } from '../shared/pill-button.js'
import { useReminderSettingsQuery } from '../../application/settings/reminder-settings.query.js'
import { REMINDER_DAYS, type ReminderDays } from '../../domain/settings/reminder-settings.js'

function label(days: ReminderDays): string {
  return days === 0 ? t('settings.on_the_day') : t('common.days_before', { count: days })
}

export function ExpiryReminderScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const settings = useReminderSettingsQuery()
  const editor = useReminderSettingsEditor()
  const refresh = usePullToRefresh(() => settings.refetch())
  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={
      <ScreenHeader palette={palette} icon={(color) => <BellIcon size={19} color={color} />}
        title={t('settings.expiry_reminders')} onBack={() => router.back()} />
    }>
      <YStack gap="$3" marginTop="$5">
        <DeviceNotificationStatus palette={palette} />
        {settings.data ? <>
          <NotificationPreferenceRow testID="expiry-reminder-enabled"
            label={t('settings.enable_reminder_for_the_household')} enabled={settings.data.enabled}
            pending={editor.pending} palette={palette} onChange={(enabled) => void editor.save({ enabled })} />
          <ReminderSaveFeedback editor={editor} palette={palette} />
          {settings.data.enabled ? <YStack gap="$3">
            <Text fontSize={15} fontWeight="700" color={palette.ink}>{t('settings.when_should_the_household_be_notified')}</Text>
            <Text fontSize={13} color={palette.inkSecondary}>{t('settings.this_applies_to_the_entire_household_each_device_with_notifications', { value1: settings.data.hour, value2: settings.data.timeZone })}</Text>
            <YStack gap="$2" accessibilityRole="radiogroup" accessibilityLabel={t('settings.expiry_reminder_lead_time')}>
              {REMINDER_DAYS.map((days) => (
                <RadioCard key={days} testID={`reminder-days-${days}`} label={label(days)}
                  description={days === 2 ? t('settings.default_choice') : undefined}
                  selected={settings.data?.days === days} disabled={editor.pending} busy={editor.pending}
                  onPress={() => void editor.save({ days })} palette={palette} />
              ))}
            </YStack>
            <Text fontSize={12} color={palette.inkSecondary} marginTop="$3">{t('settings.only_products_still_in_the_fridge_are_included_changes_to')}</Text>
          </YStack> : null}
        </> : (
          <YStack gap="$2">
            <Text color={settings.isPending ? palette.inkSecondary : palette.expiredText} accessibilityLiveRegion="polite">
              {settings.isPending ? t('settings.loading_lead_time') : t('settings.couldn_t_load_lead_time')}
            </Text>
            {!settings.isPending ? <PillButton testID="reminder-load-retry" label={t('dashboard.try_again')} palette={palette}
              tone="quiet" disabled={settings.isFetching} onPress={() => { void settings.refetch() }} /> : null}
          </YStack>
        )}
      </YStack>
    </AppShell>
  )
}
