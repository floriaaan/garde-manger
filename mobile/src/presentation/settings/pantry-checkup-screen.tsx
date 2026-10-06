import { useTranslation, weekdayLabel } from '../../i18n/index.js'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { RadioCard } from '../shared/radio-card.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { BellIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { NotificationPreferenceRow } from './notification-preference-row.js'
import { useReminderSettingsQuery } from '../../application/settings/reminder-settings.query.js'
import { useReminderSettingsEditor } from '../../application/settings/reminder-settings-editor.js'
import { DeviceNotificationStatus, ReminderSaveFeedback } from './notification-feedback.js'
import { PillButton } from '../shared/pill-button.js'

export function PantryCheckupScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const settings = useReminderSettingsQuery()
  const editor = useReminderSettingsEditor()
  const refresh = usePullToRefresh(() => settings.refetch())
  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={
      <ScreenHeader palette={palette} icon={(color) => <BellIcon size={19} color={color} />}
        title={t('settings.pantry_check_up')} onBack={() => router.back()} />
    }>
      <YStack gap="$3" marginTop="$5">
        <DeviceNotificationStatus palette={palette} />
        <Text fontSize={13} color={palette.inkSecondary}>{t('settings.once_a_week_take_a_few_minutes_to_check_quantities')}</Text>
        {settings.data ? <>
          <NotificationPreferenceRow testID="checkup-enabled" label={t('settings.enable_check_up_for_the_household')}
            enabled={settings.data.checkupEnabled} pending={editor.pending} palette={palette}
            onChange={(checkupEnabled) => void editor.save({ checkupEnabled })} />
          <ReminderSaveFeedback editor={editor} palette={palette} />
          {settings.data.checkupEnabled ? <YStack gap="$3">
            <Text fontSize={15} fontWeight="700" color={palette.ink}>{t('settings.which_day_of_the_week')}</Text>
            <Text fontSize={13} color={palette.inkSecondary}>{t('settings.for_the_entire_household_at_00_monday_by_default', { value1: settings.data.hour, value2: settings.data.timeZone })}</Text>
            <YStack gap={0} borderRadius={12} overflow="hidden" accessibilityRole="radiogroup"
              accessibilityLabel={t('settings.pantry_check_up_day')}>
              {[1, 2, 3, 4, 5, 6, 0].map((checkupDay) => <RadioCard key={checkupDay} compact
                testID={`checkup-day-${checkupDay}`} label={weekdayLabel(checkupDay)[0].toUpperCase() + weekdayLabel(checkupDay).slice(1)}
                selected={settings.data?.checkupDay === checkupDay} disabled={editor.pending} busy={editor.pending}
                onPress={() => void editor.save({ checkupDay })} palette={palette} />)}
            </YStack>
            <Text fontSize={12} color={palette.inkSecondary}>{t('settings.each_device_with_notifications_enabled_receives_this_reminder')}</Text>
          </YStack> : null}
        </> : <YStack gap="$2">
          <Text color={settings.isPending ? palette.inkSecondary : palette.expiredText} accessibilityLiveRegion="polite">
            {settings.isPending ? t('settings.loading_reminder') : t('settings.couldn_t_load_reminder')}
          </Text>
          {!settings.isPending ? <PillButton testID="reminder-load-retry" label={t('dashboard.try_again')} palette={palette}
            tone="quiet" disabled={settings.isFetching} onPress={() => { void settings.refetch() }} /> : null}
        </YStack>}
      </YStack>
    </AppShell>
  )
}
