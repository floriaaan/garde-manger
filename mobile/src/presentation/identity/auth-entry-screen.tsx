import { Redirect, router } from 'expo-router'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { ActivityIndicator } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { PillButton } from '../shared/pill-button.js'
import { AuthButton } from './auth-button.js'
import { AuthError } from './auth-error.js'
import { AuthShell, type AuthMode } from './auth-shell.js'
import { AuthMethodFooter } from './auth-method-footer.js'
import { LoginForm } from './login-form.js'
import { SignupForm } from './signup-form.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { getServerUrl, onServerUrlChange, OFFICIAL_SERVER_URL } from '../../application/shared/server-config.js'
import { getTelemetry } from '../../application/shared/telemetry.js'
import { markWelcomeSeen } from '../welcome/use-welcome-seen.js'

export function AuthEntryScreen({ initialMode = 'sign-in' }: { initialMode?: AuthMode }) {
  const palette = useSoftPalette()
  const pendingMutations = useIsMutating()
  const [nativeBusy, setNativeBusy] = useState(false)
  const authBusy = pendingMutations > 0 || nativeBusy
  const session = useSessionQuery()
  const methods = useAuthMethodsQuery()
  const server = useSyncExternalStore(onServerUrlChange, getServerUrl, getServerUrl)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [seenInitialMode, setSeenInitialMode] = useState(initialMode)
  const [emailModes, setEmailModes] = useState({ 'sign-in': false, 'sign-up': false })
  if (initialMode !== seenInitialMode) {
    setSeenInitialMode(initialMode)
    setMode(initialMode)
  }

  useEffect(() => {
    void markWelcomeSeen().catch((error) => {
      getTelemetry().recordError('welcome flag write failed', { error })
    })
  }, [])

  async function handleSuccess() {
    await session.refetch()
    router.replace('/(tabs)')
  }

  const footer = (
    <YStack gap={4} alignItems="center">
      <Text fontSize={12} color={palette.inkSecondary} textAlign="center">
        {server === OFFICIAL_SERVER_URL ? 'Serveur officiel Garde-manger' : server}
      </Text>
      <PillButton testID="auth-change-server" label="Modifier le serveur" tone="quiet" palette={palette} disabled={authBusy} onPress={() => { if (!authBusy) router.push({ pathname: '/server-choice', params: { next: mode } }) }} />
    </YStack>
  )

  if (session.data) return <Redirect href="/(tabs)" />

  const title = mode === 'sign-up' ? 'Créer mon compte' : 'Se connecter'
  const subtitle = mode === 'sign-up' ? 'Ton compte d’abord, ton foyer juste après.' : 'Retrouve ton foyer et ce qu’il reste à la maison.'
  if (methods.isPending) return (
    <AuthShell title={title} subtitle={subtitle} footer={footer}>
      <ActivityIndicator color={palette.ink} />
      <Text accessibilityLiveRegion="polite" color={palette.inkSecondary}>Recherche des méthodes de connexion…</Text>
    </AuthShell>
  )
  if (methods.isError || !methods.data?.some((method) => method.enabled)) return (
    <AuthShell title={title} subtitle={subtitle} footer={footer}>
      <AuthError message={methods.isError ? 'Impossible de joindre ce serveur. Réessaie ou modifie le serveur ci-dessous.' : 'Aucune méthode de connexion n’est disponible sur ce serveur.'} />
      <AuthButton testID="auth-method-retry" label="Réessayer" onPress={() => { void methods.refetch() }} />
    </AuthShell>
  )

  const hasPassword = methods.data.some((method) => method.id === 'password' && method.enabled)
  const passwordOnly = methods.data.filter((method) => method.enabled && (mode === 'sign-in' || method.id !== 'passkey')).every((method) => method.id === 'password')
  if (!hasPassword) return (
    <AuthShell title="Bienvenue chez toi" subtitle="Choisis comment accéder à ton garde-manger." garden footer={footer}>
      <AuthMethodFooter key={server} emailLabel="Continuer avec e-mail" emailForm={null} onSuccess={handleSuccess} disabled={authBusy} onNativeBusyChange={setNativeBusy} />
    </AuthShell>
  )

  return (
    <AuthShell
      key={server}
      mode={mode}
      onModeChange={setMode}
      busy={authBusy}
      garden={mode === 'sign-up' && !emailModes[mode] && !passwordOnly}
      footer={footer}
      pages={{
        signIn: {
          title: 'Se connecter',
          subtitle: 'Retrouve ton foyer et ce qu’il reste à la maison.',
          content: <AuthMethodFooter emailLabel="Continuer avec e-mail" emailForm={<LoginForm onSuccess={handleSuccess} />} onSuccess={handleSuccess} disabled={authBusy} onNativeBusyChange={setNativeBusy} onEmailModeChange={(active) => setEmailModes((current) => ({ ...current, 'sign-in': active }))} />,
        },
        signUp: {
          title: 'Créer mon compte',
          subtitle: 'Ton compte d’abord, ton foyer juste après.',
          content: <AuthMethodFooter emailLabel="Créer un compte avec e-mail" allowPasskey={false} emailForm={<SignupForm onSuccess={handleSuccess} />} onSuccess={handleSuccess} disabled={authBusy} onNativeBusyChange={setNativeBusy} onEmailModeChange={(active) => setEmailModes((current) => ({ ...current, 'sign-up': active }))} />,
        },
      }}
    />
  )
}
