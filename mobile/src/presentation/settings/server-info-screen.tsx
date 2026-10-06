import { useTranslation } from '../../i18n/index.js'
/**
 * Réglages > Serveur > "Changer de serveur" — its own page rather than a
 * button inline on Réglages, because switching servers is the same
 * radio-card + verify/save decision as onboarding's server-choice screen,
 * not a one-tap action. `ServerChoiceForm` (`../shared/server-choice-form.js`)
 * is the shared form; this screen only supplies what's specific to
 * *changing* an already-configured server: this device's session belongs to
 * the server being left, so it can't come along — best-effort sign-out,
 * then clear every cached query before pointing the app at the new one, or
 * the new server's screens would flash the old one's household/AI settings
 * until each query refetched.
 */
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { ServerChoiceForm } from '../shared/server-choice-form.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ServerIcon } from '../dashboard/dashboard-icons.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import { getServerUrl, setServerUrl } from '../../application/shared/server-config.js'

export function ServerInfoScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const signOut = useSignOutMutation()
  const queryClient = useQueryClient()

  async function handleSave(url: string) {
    try {
      await signOut.mutateAsync(undefined)
    } catch {
      // Preview it anyway — this device's account belongs to the server
      // being left; the new server has no use for a sign-out that failed.
    }
    queryClient.clear()
    await setServerUrl(url)
    router.replace('/(auth)/sign-in')
  }

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ServerIcon size={19} color={color} />}
          title={t('settings.change_server')}
          onBack={() => router.back()}
        />
      }
    >
      <ServerChoiceForm
        palette={palette}
        defaultUrl={getServerUrl()}
        saveLabel={t('shared.save')}
        onSave={handleSave}
      />
    </AppShell>
  )
}
