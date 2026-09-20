/**
 * Debug modal — opened by triple-tapping the logo on the auth screens.
 * Read-only diagnostics plus "clear app state" for a device stuck on a stale
 * server / session. Not gated by `__DEV__`: it is precisely the tool a
 * release build needs when the server URL is wrong.
 */
import { useState } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { SettingsIcon, TriangleAlertIcon } from '../dashboard/dashboard-icons.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { PillButton } from '../shared/pill-button.js'
import { BootSplash } from '../shared/boot-splash.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import { queryClient } from '../../application/shared/query-client.js'
import {
  APP_VERSION,
  OFFICIAL_SERVER_URL,
  clearServerUrl,
  getDefaultServerUrl,
  getServerUrl,
} from '../../application/shared/server-config.js'
import { resetWelcomeSeen, useHasSeenWelcome } from '../welcome/use-welcome-seen.js'

const SIGN_OUT_TIMEOUT_MS = 2000

/** Screens that only appear after an action (a scan, a job), so they are hard to reach by hand. */
const SCREENS: [string, string][] = [
  ['Tâches', '/tasks'],
  ['Scanner un ticket', '/receipts/scan'],
  ['Scanner le frigo', '/fridge-scan/scan'],
  ['Générer des recettes', '/(tabs)/recipes/generate'],
  ['Relecture ticket (sans brouillon)', '/receipts/review'],
  ['Relecture frigo (sans brouillon)', '/fridge-scan/review'],
]

export function DebugScreen() {
  const palette = useSoftPalette()
  const session = useSessionQuery()
  const signOut = useSignOutMutation()
  const hasSeenWelcome = useHasSeenWelcome()
  const [confirming, setConfirming] = useState(false)
  // Previewing the splash has no way back on purpose: reload the app to leave it.
  const [showSplash, setShowSplash] = useState(false)

  const rows: [string, string][] = [
    ['Version', APP_VERSION],
    ['Plateforme', `${Platform.OS} ${Platform.Version}`],
    ['Mode', __DEV__ ? 'dev' : 'release'],
    ['Connecteur', process.env.EXPO_PUBLIC_CONNECTOR ?? 'http'],
    ['Serveur actuel', getServerUrl()],
    ['Serveur par défaut', getDefaultServerUrl()],
    ['Serveur officiel', OFFICIAL_SERVER_URL],
    ['Session', session.isPending ? 'en attente' : session.data ? `connecté (${session.data.user.email})` : 'aucune'],
    ['Accueil vu', hasSeenWelcome === null ? '?' : String(hasSeenWelcome)],
  ]

  // Best-effort sign-out, capped: an unreachable server (the usual reason to
  // be here) must not leave the reset hanging on the request timeout.
  async function clearState() {
    await Promise.race([
      signOut.mutateAsync(undefined).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, SIGN_OUT_TIMEOUT_MS)),
    ])
    await resetWelcomeSeen()
    await clearServerUrl()
    router.replace('/welcome')
    // After navigating: clearing first would flip the gates below to their splash mid-transition.
    queryClient.clear()
  }

  if (showSplash) return <BootSplash />

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      header={<ScreenHeader palette={palette} icon={(color) => <SettingsIcon size={19} color={color} />} title="Debug" onBack={() => router.back()} />}
    >
      <YStack testID="debug-info" gap="$2" marginTop="$5">
        {rows.map(([label, value]) => (
          <YStack key={label} padding="$3" borderRadius="$3" backgroundColor={palette.gradientBottom}>
            <Text fontSize={12} color={palette.inkSecondary}>
              {label}
            </Text>
            <Text fontSize={14} fontWeight="700" color={palette.ink} selectable>
              {value}
            </Text>
          </YStack>
        ))}
        <Text fontSize={12} fontWeight="800" color={palette.inkSecondary} marginTop="$3">
          Écrans à action
        </Text>
        {SCREENS.map(([label, href]) => (
          <PillButton
            key={href}
            testID={`debug-open-${href}`}
            tone="quiet"
            label={label}
            palette={palette}
            onPress={() => router.push(href as Parameters<typeof router.push>[0])}
          />
        ))}
        <PillButton
          testID="debug-show-splash"
          tone="quiet"
          label="Voir le splash"
          palette={palette}
          onPress={() => setShowSplash(true)}
        />
        <PillButton
          testID="debug-clear-state"
          tone="quiet"
          label="Réinitialiser l’application"
          palette={palette}
          onPress={() => setConfirming(true)}
        />
      </YStack>
      <ActionSheet
        visible={confirming}
        title="Réinitialiser l’application ?"
        description="Tu seras déconnecté, l’adresse du serveur et l’accueil seront remis à zéro sur cet appareil."
        options={[
          {
            testID: 'debug-clear-state-confirm',
            label: 'Réinitialiser',
            icon: (color) => <TriangleAlertIcon size={18} color={color} />,
            tint: palette.expiredBg,
            destructive: true,
            onPress: () => {
              setConfirming(false)
              void clearState()
            },
          },
        ]}
        onClose={() => setConfirming(false)}
      />
    </AppShell>
  )
}
