import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { RadioCard } from '../shared/radio-card.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { BellIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { NotificationsRow } from './notifications-row.js'
import { useReminderSettingsQuery } from '../../application/settings/reminder-settings.query.js'
import { useSetReminderDaysMutation } from '../../application/settings/set-reminder-days.mutation.js'
import { REMINDER_DAYS, type ReminderDays } from '../../domain/settings/reminder-settings.js'

function label(days: ReminderDays): string {
  return days === 0 ? 'Le jour même' : days === 1 ? '1 jour avant' : `${days} jours avant`
}

export function ExpiryReminderScreen() {
  const palette = useSoftPalette()
  const settings = useReminderSettingsQuery()
  const update = useSetReminderDaysMutation()
  const queryClient = useQueryClient()
  const refresh = usePullToRefresh(() => settings.refetch())
  const [error, setError] = useState<string | null>(null)

  async function choose(days: ReminderDays) {
    if (update.isPending || days === settings.data?.days) return
    setError(null)
    const result = await update.mutateAsync(days)
    if (!result.ok) {
      setError('Impossible d’enregistrer le délai. Réessaie.')
      return
    }
    queryClient.setQueryData(['reminder-settings'], result.value)
  }

  return (
    <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={
      <ScreenHeader palette={palette} icon={(color) => <BellIcon size={19} color={color} />}
        title="Rappels de péremption" onBack={() => router.back()} />
    }>
      <YStack gap="$3" marginTop="$5">
        <Text fontSize={15} fontWeight="700" color={palette.ink}>
          Quand veux-tu être prévenu ?
        </Text>
        <Text fontSize={13} color={palette.inkSecondary}>
          Ce choix vaut pour tout le foyer. Chaque appareil ayant activé les notifications reçoit un résumé quotidien{settings.data ? ` à ${settings.data.hour} h (${settings.data.timeZone})` : ''}.
        </Text>
        {settings.data ? (
          <YStack gap="$2" accessibilityRole="radiogroup">
            {REMINDER_DAYS.map((days) => (
              <RadioCard key={days} testID={`reminder-days-${days}`} label={label(days)}
                description={days === 2 ? 'Choix par défaut' : undefined}
                selected={settings.data.days === days} disabled={update.isPending}
                onPress={() => void choose(days)} palette={palette} />
            ))}
          </YStack>
        ) : (
          <Text color={settings.isPending ? palette.inkSecondary : palette.expiredText}>
            {settings.isPending ? 'Chargement du délai…' : 'Impossible de charger le délai. Tire pour réessayer.'}
          </Text>
        )}
        {error ? <Text color={palette.expiredText} accessibilityLiveRegion="polite">{error}</Text> : null}
        <Text fontSize={12} color={palette.inkSecondary} marginTop="$3">
          Seuls les produits encore dans le frigo sont pris en compte. Une date ou un délai modifié s’applique au prochain résumé.
        </Text>
        <Text fontSize={13} fontWeight="700" color={palette.ink} marginTop="$4">
          Sur cet appareil
        </Text>
        <NotificationsRow palette={palette} />
      </YStack>
    </AppShell>
  )
}
