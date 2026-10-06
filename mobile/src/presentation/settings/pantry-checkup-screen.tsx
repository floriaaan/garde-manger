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
import { CHECKUP_DAYS } from '../../domain/settings/reminder-settings.js'

export function PantryCheckupScreen() {
  const palette = useSoftPalette()
  const settings = useReminderSettingsQuery()
  const editor = useReminderSettingsEditor()
  const refresh = usePullToRefresh(() => settings.refetch())
  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={
      <ScreenHeader palette={palette} icon={(color) => <BellIcon size={19} color={color} />}
        title="Check-up du garde-manger" onBack={() => router.back()} />
    }>
      <YStack gap="$3" marginTop="$5">
        <DeviceNotificationStatus palette={palette} />
        <Text fontSize={13} color={palette.inkSecondary}>
          Une fois par semaine, prends quelques minutes pour vérifier les quantités et supprimer les produits déjà consommés. Le rappel ouvre ton inventaire pour le mettre à jour.
        </Text>
        {settings.data ? <>
          <NotificationPreferenceRow testID="checkup-enabled" label="Activer le check-up pour le foyer"
            enabled={settings.data.checkupEnabled} pending={editor.pending} palette={palette}
            onChange={(checkupEnabled) => void editor.save({ checkupEnabled })} />
          <ReminderSaveFeedback editor={editor} palette={palette} />
          {settings.data.checkupEnabled ? <YStack gap="$3">
            <Text fontSize={15} fontWeight="700" color={palette.ink}>Quel jour de la semaine ?</Text>
            <Text fontSize={13} color={palette.inkSecondary}>
              Pour tout le foyer, à {settings.data.hour} h ({settings.data.timeZone}). Le lundi par défaut.
            </Text>
            <YStack gap={0} borderRadius={12} overflow="hidden" accessibilityRole="radiogroup"
              accessibilityLabel="Jour du check-up du garde-manger">
              {[1, 2, 3, 4, 5, 6, 0].map((checkupDay) => <RadioCard key={checkupDay} compact
                testID={`checkup-day-${checkupDay}`} label={CHECKUP_DAYS[checkupDay][0].toUpperCase() + CHECKUP_DAYS[checkupDay].slice(1)}
                selected={settings.data?.checkupDay === checkupDay} disabled={editor.pending} busy={editor.pending}
                onPress={() => void editor.save({ checkupDay })} palette={palette} />)}
            </YStack>
            <Text fontSize={12} color={palette.inkSecondary}>
              Chaque appareil ayant activé les notifications reçoit ce rappel.
            </Text>
          </YStack> : null}
        </> : <YStack gap="$2">
          <Text color={settings.isPending ? palette.inkSecondary : palette.expiredText} accessibilityLiveRegion="polite">
            {settings.isPending ? 'Chargement du rappel…' : 'Impossible de charger le rappel.'}
          </Text>
          {!settings.isPending ? <PillButton testID="reminder-load-retry" label="Réessayer" palette={palette}
            tone="quiet" disabled={settings.isFetching} onPress={() => { void settings.refetch() }} /> : null}
        </YStack>}
      </YStack>
    </AppShell>
  )
}
