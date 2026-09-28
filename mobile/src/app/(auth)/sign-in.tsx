import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { Text, YStack } from '../../presentation/shared/tamagui-typed.js'
import { useSoftPalette } from '../../presentation/dashboard/soft-palette.js'
import { AuthButton } from '../../presentation/identity/auth-button.js'
import { AuthError } from '../../presentation/identity/auth-error.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { LoginForm } from '../../presentation/identity/login-form.js'
import { SignupForm } from '../../presentation/identity/signup-form.js'
import { AuthMethodFooter } from '../../presentation/identity/auth-method-footer.js'
import { AuthShell } from '../../presentation/identity/auth-shell.js'
import { useSessionQuery } from '../../application/identity/session.query.js'

export default function SignInScreen() {
  const session = useSessionQuery()
  const authMethods = useAuthMethodsQuery()
  const palette = useSoftPalette()
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode === 'sign-up' ? 'sign-up' : 'sign-in')

  async function handleSuccess() {
    await session.refetch()
    router.replace('/(tabs)')
  }

  if (authMethods.isPending) return (
    <AuthShell title="Connexion" subtitle="Retrouve ton garde-manger et ton foyer.">
      <YStack gap="$3" alignItems="center" paddingVertical="$3">
        <ActivityIndicator color={palette.accentLime} />
        <Text fontSize={14} color={palette.onDarkSecondary} accessibilityLiveRegion="polite">Recherche des méthodes de connexion…</Text>
      </YStack>
    </AuthShell>
  )

  if (authMethods.isError || !authMethods.data?.some((method) => method.enabled)) return (
    <AuthShell title="Connexion" subtitle="Retrouve ton garde-manger et ton foyer.">
      <YStack gap="$3">
        <AuthError message={authMethods.isError ? 'Impossible de charger les méthodes de connexion.' : 'Aucune méthode de connexion n’est disponible sur ce serveur.'} />
        <AuthButton label="Réessayer" onPress={() => { void authMethods.refetch() }} testID="auth-method-retry" />
      </YStack>
    </AuthShell>
  )

  if (!authMethods.data.some((method) => method.id === 'password' && method.enabled)) return (
    <AuthShell title="Connexion" subtitle="Choisis comment accéder à ton garde-manger.">
      <AuthMethodFooter emailLabel="Continuer avec e-mail" emailForm={null} onSuccess={handleSuccess} />
    </AuthShell>
  )

  return (
    <AuthShell
      mode={mode}
      onModeChange={setMode}
      pages={{
        signIn: {
          title: 'Connexion',
          subtitle: 'Retrouve ton garde-manger et ton foyer.',
          content: <AuthMethodFooter emailLabel="Continuer avec e-mail" emailForm={<LoginForm onSuccess={handleSuccess} />} onSuccess={handleSuccess} />,
        },
        signUp: {
          title: 'Créer mon compte',
          subtitle: 'Commence ton garde-manger partagé avec ton foyer.',
          content: <AuthMethodFooter emailLabel="Créer un compte avec e-mail" allowPasskey={false} emailForm={<SignupForm onSuccess={handleSuccess} />} onSuccess={handleSuccess} />,
        },
      }}
    />
  )
}
