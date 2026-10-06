import { t, useTranslation, getLocaleOverride, setLocaleOverride, type LocaleOverride } from '../../i18n/index.js'
/**
 * Debug modal — opened by triple-tapping the logo on the auth screens.
 * Read-only diagnostics plus "clear app state" for a device stuck on a stale
 * server / session. Not gated by `__DEV__`: it is precisely the tool a
 * release build needs when the server URL is wrong.
 */
import { useState } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { Chip } from '../shared/chip.js'
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
const debugScreens = (): [string, string][] => [
  [t('dashboard.tasks'), '/tasks'],
  [t('debug.scan_a_receipt'), '/receipts/scan'],
  [t('debug.scan_the_fridge'), '/fridge-scan/scan'],
  [t('debug.generate_recipes'), '/(tabs)/recipes/generate'],
  [t('debug.review_receipt_no_draft'), '/receipts/review'],
  [t('debug.review_fridge_no_draft'), '/fridge-scan/review'],
]

export function DebugScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const session = useSessionQuery()
  const signOut = useSignOutMutation()
  const hasSeenWelcome = useHasSeenWelcome()
  const [confirming, setConfirming] = useState(false)
  const [localeOverride, setOverride] = useState<LocaleOverride>(getLocaleOverride)
  // Previewing the splash has no way back on purpose: reload the app to leave it.
  const [showSplash, setShowSplash] = useState(false)

  const rows: [string, string][] = [
    [t('debug.version'), APP_VERSION],
    [t('debug.platform'), `${Platform.OS} ${Platform.Version}`],
    [t('debug.mode'), __DEV__ ? 'dev' : 'release'],
    [t('debug.connector'), process.env.EXPO_PUBLIC_CONNECTOR ?? 'http'],
    [t('debug.current_server'), getServerUrl()],
    [t('debug.default_server'), getDefaultServerUrl()],
    [t('debug.official_server'), OFFICIAL_SERVER_URL],
    [t('debug.session'), session.isPending ? t('debug.waiting') : session.data ? t('debug.signed_in', { value1: session.data.user.email }) : t('debug.none')],
    [t('debug.welcome_seen'), hasSeenWelcome === null ? '?' : String(hasSeenWelcome)],
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
    setLocaleOverride(null)
    router.replace('/welcome')
    // After navigating: clearing first would flip the gates below to their splash mid-transition.
    queryClient.clear()
  }

  if (showSplash) return <BootSplash />

  return (
    <AppShell
      nav={{ kind: 'modal' }}
      header={<ScreenHeader palette={palette} icon={(color) => <SettingsIcon size={19} color={color} />} title={t('debug.debug')} onBack={() => router.back()} />}
    >
      <YStack testID="debug-info" gap="$2" marginTop="$5">
        <YStack gap="$2" padding="$3" borderRadius="$3" backgroundColor={palette.gradientBottom}>
          <Text fontSize={12} color={palette.inkSecondary}>{t('debug.language')}</Text>
          <XStack gap="$3" flexWrap="wrap">
            {([null, 'fr', 'en'] as const).map((language) => (
              <Chip
                key={language ?? 'system'}
                testID={`debug-locale-${language ?? 'system'}`}
                label={language === null ? t('debug.system_language') : language === 'fr' ? 'Français' : 'English'}
                selected={localeOverride === language}
                palette={palette}
                onPress={() => {
                  setOverride(language)
                  setLocaleOverride(language)
                }}
              />
            ))}
          </XStack>
          <Text fontSize={12} color={palette.inkSecondary}>{t('debug.language_session_only')}</Text>
        </YStack>
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
        <Text fontSize={12} fontWeight="800" color={palette.inkSecondary} marginTop="$3">{t('debug.action_screens')}</Text>
        {debugScreens().map(([label, href]) => (
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
          label={t('debug.view_splash')}
          palette={palette}
          onPress={() => setShowSplash(true)}
        />
        <PillButton
          testID="debug-clear-state"
          tone="quiet"
          label={t('debug.reset_the_app')}
          palette={palette}
          onPress={() => setConfirming(true)}
        />
      </YStack>
      <ActionSheet
        visible={confirming}
        title={t('debug.reset_the_app_2')}
        description={t('debug.you_ll_be_signed_out_the_server_address_and_welcome')}
        options={[
          {
            testID: 'debug-clear-state-confirm',
            label: t('debug.reset'),
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
