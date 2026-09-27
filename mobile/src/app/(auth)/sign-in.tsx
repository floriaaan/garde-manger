import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { LoginForm } from '../../presentation/identity/login-form.js'
import { SignupForm } from '../../presentation/identity/signup-form.js'
import { AuthMethodFooter } from '../../presentation/identity/auth-method-footer.js'
import { AuthShell } from '../../presentation/identity/auth-shell.js'
import { useSessionQuery } from '../../application/identity/session.query.js'

export default function SignInScreen() {
  const session = useSessionQuery()
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode === 'sign-up' ? 'sign-up' : 'sign-in')

  async function handleSuccess() {
    await session.refetch()
    router.replace('/(tabs)')
  }

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
