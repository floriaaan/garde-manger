import { useTranslation, weekdayLabel } from '../../i18n/index.js'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { BellIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { IdentityCard } from './identity-card.js'
import { NotificationsRow } from './notifications-row.js'
import { useReminderSettingsQuery } from '../../application/settings/reminder-settings.query.js'
import { PillButton } from '../shared/pill-button.js'

export function NotificationsScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const settings = useReminderSettingsQuery()
  const refresh = usePullToRefresh(() => settings.refetch())
  const preferences = settings.data
  const unavailableState = settings.isPending ? t('dashboard.loading_2') : t('settings.status_unavailable')
  const expiryState = preferences ? preferences.enabled ? t('settings.enabled_for_household') : t('settings.disabled_for_household') : unavailableState
  const checkupState = preferences ? preferences.checkupEnabled ? t('settings.enabled_for_household') : t('settings.disabled_for_household') : unavailableState
  const expirySchedule = preferences ? preferences.days === 0 ? t('settings.on_the_expiry_date')
    : t('settings.day_before_expiry', { count: preferences.days }) : t('settings.choose_how_many_days_before_expiry')
  const checkupSchedule = preferences ? t('settings.once_a_week_on', { value1: weekdayLabel(preferences.checkupDay) })
    : t('settings.a_reminder_to_keep_your_inventory_up_to_date')
  const expirySummary = preferences && !preferences.enabled ? t('settings.lead_time_saved', { value1: expirySchedule }) : expirySchedule
  const checkupSummary = preferences && !preferences.checkupEnabled
    ? t('settings.day_saved', { value1: weekdayLabel(preferences.checkupDay) }) : checkupSchedule
  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={
      <ScreenHeader palette={palette} icon={(color) => <BellIcon size={19} color={color} />}
        title={t('settings.notifications')} onBack={() => router.back()} />
    }>
      <YStack gap="$3" marginTop="$5">
        <NotificationsRow palette={palette} />
        <Text fontSize={13} color={palette.inkSecondary}>{t('settings.the_main_switch_enables_or_disables_all_notifications_on_this')}</Text>
        <IdentityCard testID="notifications-expiry-reminders" bg={palette.butter}
          labelColor={palette.butterText} chipColor={palette.chipButter}
          icon={<BellIcon size={18} color={palette.onDark} />} label={t('settings.expiry_reminder')}
          value={expiryState} emphasizeLabel
          accessibilityLabel={t('settings.expiry_reminder_edit_reminder', { value1: expiryState, value2: expirySummary })}
          secondary={expirySummary} corner="a" palette={palette}
          onPress={() => router.push('/expiry-reminders')} />
        <IdentityCard testID="notifications-pantry-checkup" bg={palette.mintPale}
          labelColor={palette.mintPaleText} chipColor={palette.chipTeal}
          icon={<BellIcon size={18} color={palette.onDark} />} label={t('settings.pantry_check_up')}
          value={checkupState} emphasizeLabel
          accessibilityLabel={t('settings.pantry_check_up_edit_reminder', { value1: checkupState, value2: checkupSummary })}
          secondary={checkupSummary}
          corner="b" palette={palette} onPress={() => router.push('/pantry-checkup')} />
        {!preferences ? <YStack gap="$2">
          <Text color={settings.isPending ? palette.inkSecondary : palette.expiredText} accessibilityLiveRegion="polite">
            {settings.isPending ? t('settings.loading_reminders') : t('settings.couldn_t_load_reminders')}
          </Text>
          {!settings.isPending ? <PillButton testID="reminder-load-retry" label={t('dashboard.try_again')} palette={palette}
            tone="quiet" disabled={settings.isFetching} onPress={() => { void settings.refetch() }} /> : null}
        </YStack> : null}
      </YStack>
    </AppShell>
  )
}
