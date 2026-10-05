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
import { CHECKUP_DAYS } from '../../domain/settings/reminder-settings.js'

export function NotificationsScreen() {
  const palette = useSoftPalette()
  const settings = useReminderSettingsQuery()
  const refresh = usePullToRefresh(() => settings.refetch())
  const preferences = settings.data
  const unavailableState = settings.isPending ? 'Chargement…' : 'État indisponible'
  const expiryState = preferences ? preferences.enabled ? 'Activé pour le foyer' : 'Désactivé pour le foyer' : unavailableState
  const checkupState = preferences ? preferences.checkupEnabled ? 'Activé pour le foyer' : 'Désactivé pour le foyer' : unavailableState
  const expirySchedule = preferences ? preferences.days === 0 ? 'Le jour de la péremption.'
    : `${preferences.days} jour${preferences.days > 1 ? 's' : ''} avant la péremption.` : 'Choisir le délai avant la péremption.'
  const checkupSchedule = preferences ? `Une fois par semaine, le ${CHECKUP_DAYS[preferences.checkupDay]}.`
    : 'Un rappel pour garder ton inventaire à jour.'
  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={
      <ScreenHeader palette={palette} icon={(color) => <BellIcon size={19} color={color} />}
        title="Notifications" onBack={() => router.back()} />
    }>
      <YStack gap="$3" marginTop="$5">
        <NotificationsRow palette={palette} />
        <Text fontSize={13} color={palette.inkSecondary}>
          L’interrupteur général active ou coupe toutes les notifications sur cet appareil. Les rappels ci-dessous sont réglés pour tout le foyer.
        </Text>
        <IdentityCard testID="notifications-expiry-reminders" bg={palette.butter}
          labelColor={palette.butterText} chipColor={palette.chipButter}
          icon={<BellIcon size={18} color={palette.onDark} />} label="Rappel de péremption"
          value={expiryState} emphasizeLabel
          accessibilityLabel={`Rappel de péremption. ${expiryState}. ${expirySchedule} Modifier ce rappel.`}
          secondary={expirySchedule} corner="a" palette={palette}
          onPress={() => router.push('/expiry-reminders')} />
        <IdentityCard testID="notifications-pantry-checkup" bg={palette.mintPale}
          labelColor={palette.mintPaleText} chipColor={palette.chipTeal}
          icon={<BellIcon size={18} color={palette.onDark} />} label="Check-up du garde-manger"
          value={checkupState} emphasizeLabel
          accessibilityLabel={`Check-up du garde-manger. ${checkupState}. ${checkupSchedule} Modifier ce rappel.`}
          secondary={checkupSchedule}
          corner="b" palette={palette} onPress={() => router.push('/pantry-checkup')} />
        {!preferences ? <YStack gap="$2">
          <Text color={settings.isPending ? palette.inkSecondary : palette.expiredText} accessibilityLiveRegion="polite">
            {settings.isPending ? 'Chargement des rappels…' : 'Impossible de charger les rappels.'}
          </Text>
          {!settings.isPending ? <PillButton testID="reminder-load-retry" label="Réessayer" palette={palette}
            tone="quiet" disabled={settings.isFetching} onPress={() => { void settings.refetch() }} /> : null}
        </YStack> : null}
      </YStack>
    </AppShell>
  )
}
