import { useState } from 'react'
import zxcvbn from 'zxcvbn'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useSignUpMutation } from '../../application/identity/sign-up.mutation.js'
import { authErrorMessage } from './auth-error-message.js'
import { AuthButton } from './auth-button.js'
import { AuthError } from './auth-error.js'
import { AuthField } from './auth-field.js'
import { AuthPasswordField } from './auth-password-field.js'

export function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const palette = useSoftPalette()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signUp = useSignUpMutation()

  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  // Not password.trim() — see login-form.tsx's own note.
  const canSubmit = trimmedName.length > 0 && trimmedEmail.length > 0 && password.length >= 8 && password.length <= 128
  const strength = password ? zxcvbn(password, [trimmedName, trimmedEmail]).score : 0
  const strengthLabels = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Très bon']
  const strengthColors = [palette.expired, palette.expired, palette.soon, palette.fresh, palette.fresh]

  async function handleSubmit() {
    if (!canSubmit) return
    const result = await signUp.mutateAsync({ email: trimmedEmail, password, name: trimmedName })
    if (result.ok) onSuccess()
  }

  const error = authErrorMessage(signUp.error, signUp.data, "Une erreur est survenue lors de l'inscription.")

  return (
    <YStack gap="$3">
      <AuthField
        label="Nom"
        labelColor={palette.onDarkSecondary}
        placeholder="Ton prénom"
        value={name}
        onChangeText={setName}
        testID="signup-name"
      />
      <AuthField
        label="Email"
        labelColor={palette.onDarkSecondary}
        placeholder="toi@exemple.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        testID="signup-email"
      />
      <AuthPasswordField
        label="Mot de passe"
        labelColor={palette.onDarkSecondary}
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        testID="signup-password"
      />
      <Text fontSize={12} fontWeight="600" color={palette.onDarkSecondary}>
        Entre 8 et 128 caractères.
      </Text>
      {password ? (
        <YStack gap="$1" accessibilityLabel={`Force du mot de passe : ${strengthLabels[strength]}`}>
          <XStack gap="$1">
            {[0, 1, 2, 3, 4].map((segment) => (
              <YStack key={segment} flex={1} height={5} borderRadius={999} backgroundColor={segment <= strength ? strengthColors[strength] : palette.heroPillFill} />
            ))}
          </XStack>
          <Text fontSize={12} fontWeight="700" color={palette.onDarkSecondary}>
            {`Force du mot de passe : ${strengthLabels[strength]}`}
          </Text>
        </YStack>
      ) : null}
      {error ? <AuthError message={error} /> : null}
      <AuthButton
        label="S'inscrire"
        pendingLabel="Inscription..."
        pending={signUp.isPending}
        disabled={!canSubmit}
        onPress={handleSubmit}
        testID="signup-submit"
      />
    </YStack>
  )
}
