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
  return days === 0 ? 'Le jour même' : days === 1 ? '1 jour avant' : `${days} jours avant`
}

export function ExpiryReminderScreen() {
  const palette = useSoftPalette()
  const settings = useReminderSettingsQuery()
  const editor = useReminderSettingsEditor()
  const refresh = usePullToRefresh(() => settings.refetch())
  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={
      <ScreenHeader palette={palette} icon={(color) => <BellIcon size={19} color={color} />}
        title="Rappels de péremption" onBack={() => router.back()} />
    }>
      <YStack gap="$3" marginTop="$5">
        <DeviceNotificationStatus palette={palette} />
        {settings.data ? <>
          <NotificationPreferenceRow testID="expiry-reminder-enabled"
            label="Activer le rappel pour le foyer" enabled={settings.data.enabled}
            pending={editor.pending} palette={palette} onChange={(enabled) => void editor.save({ enabled })} />
          <ReminderSaveFeedback editor={editor} palette={palette} />
          {settings.data.enabled ? <YStack gap="$3">
            <Text fontSize={15} fontWeight="700" color={palette.ink}>
              Quand prévenir le foyer ?
            </Text>
            <Text fontSize={13} color={palette.inkSecondary}>
              Ce choix vaut pour tout le foyer. Chaque appareil ayant activé les notifications reçoit un résumé quotidien à {settings.data.hour} h ({settings.data.timeZone}).
            </Text>
            <YStack gap="$2" accessibilityRole="radiogroup" accessibilityLabel="Délai du rappel de péremption">
              {REMINDER_DAYS.map((days) => (
                <RadioCard key={days} testID={`reminder-days-${days}`} label={label(days)}
                  description={days === 2 ? 'Choix par défaut' : undefined}
                  selected={settings.data?.days === days} disabled={editor.pending} busy={editor.pending}
                  onPress={() => void editor.save({ days })} palette={palette} />
              ))}
            </YStack>
            <Text fontSize={12} color={palette.inkSecondary} marginTop="$3">
              Seuls les produits encore dans le frigo sont pris en compte. Une date ou un délai modifié s’applique au prochain résumé.
            </Text>
          </YStack> : null}
        </> : (
          <YStack gap="$2">
            <Text color={settings.isPending ? palette.inkSecondary : palette.expiredText} accessibilityLiveRegion="polite">
              {settings.isPending ? 'Chargement du délai…' : 'Impossible de charger le délai.'}
            </Text>
            {!settings.isPending ? <PillButton testID="reminder-load-retry" label="Réessayer" palette={palette}
              tone="quiet" disabled={settings.isFetching} onPress={() => { void settings.refetch() }} /> : null}
          </YStack>
        )}
      </YStack>
    </AppShell>
  )
}
