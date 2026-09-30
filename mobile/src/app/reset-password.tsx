import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, YStack } from '../presentation/shared/tamagui-typed.js'
import { AuthShell } from '../presentation/identity/auth-shell.js'
import { AuthPasswordField } from '../presentation/identity/auth-password-field.js'
import { AuthButton } from '../presentation/identity/auth-button.js'
import { AuthError } from '../presentation/identity/auth-error.js'
import { authErrorMessage } from '../presentation/identity/auth-error-message.js'
import { useSoftPalette } from '../presentation/dashboard/soft-palette.js'
import { useResetPasswordMutation } from '../application/identity/password-reset.mutation.js'

export default function ResetPasswordScreen() {
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>()
  const palette = useSoftPalette()
  const reset = useResetPasswordMutation()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)
  const invalidLink = !token || Boolean(error)
  const validPassword = password.length >= 8 && password.length <= 128 && password === confirmation
  const resetError = authErrorMessage(reset.error, reset.data, 'Impossible de réinitialiser le mot de passe.')

  async function submit() {
    if (!token || !validPassword) return
    const result = await reset.mutateAsync({ token, password })
    if (result.ok) setDone(true)
  }

  return (
    <AuthShell title="Nouveau mot de passe" subtitle="Retrouve l’accès à ton garde-manger.">
      <YStack gap="$3">
        {done ? (
          <Text fontSize={14} color={palette.inkSecondary} accessibilityLiveRegion="polite">
            Ton mot de passe a été changé. Tu peux te connecter.
          </Text>
        ) : invalidLink ? (
          <AuthError message="Ce lien est invalide ou a expiré. Demande un nouveau lien depuis la connexion." />
        ) : (
          <>
            <AuthPasswordField label="Nouveau mot de passe" labelColor={palette.inkSecondary} placeholder="••••••••" value={password} onChangeText={setPassword} autoComplete="new-password" testID="reset-password" />
            <AuthPasswordField label="Confirmer le mot de passe" labelColor={palette.inkSecondary} placeholder="••••••••" value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" testID="reset-confirmation" />
            <Text fontSize={12} color={palette.inkSecondary}>Entre 8 et 128 caractères.</Text>
            {confirmation && password !== confirmation ? <AuthError message="Les mots de passe ne correspondent pas." /> : null}
            {resetError ? <AuthError message={resetError} /> : null}
            <AuthButton label="Changer mon mot de passe" pendingLabel="Enregistrement..." pending={reset.isPending} disabled={!validPassword} onPress={submit} testID="reset-submit" />
          </>
        )}
        <AuthButton label="Retour à la connexion" variant="secondary" onPress={() => router.replace('/(auth)/sign-in')} testID="reset-back" />
      </YStack>
    </AuthShell>
  )
}
