import { useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useSignInEmailMutation } from '../../application/identity/sign-in.mutation.js'
import { authErrorMessage } from './auth-error-message.js'
import { AuthButton } from './auth-button.js'
import { AuthError } from './auth-error.js'
import { AuthField } from './auth-field.js'
import { AuthPasswordField } from './auth-password-field.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useRequestPasswordResetMutation } from '../../application/identity/password-reset.mutation.js'
import { isFakeConnector } from '../../application/shared/connector-mode.js'
import { router } from 'expo-router'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const palette = useSoftPalette()
  const passwordRef = useRef<TextInput>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recovery, setRecovery] = useState<'login' | 'request' | 'sent' | 'unavailable'>('login')
  const signIn = useSignInEmailMutation()
  const requestReset = useRequestPasswordResetMutation()
  const authMethods = useAuthMethodsQuery()
  const resetAvailable = authMethods.data?.find((method) => method.id === 'password')?.resetAvailable === true

  const trimmedEmail = email.trim()
  // Not password.trim() — a leading/trailing space in a password can be
  // intentional and part of it; email whitespace from autofill/autocapitalize
  // is never meaningful and was a real source of confusing false-negative
  // logins.
  const canSubmit = trimmedEmail.length > 0 && password.length > 0

  async function handleSubmit() {
    if (!canSubmit || signIn.isPending) return
    const result = await signIn.mutateAsync({ email: trimmedEmail, password })
    if (result.ok) onSuccess()
  }

  async function handleRequestReset() {
    if (!trimmedEmail) return
    const result = await requestReset.mutateAsync(trimmedEmail)
    if (result.ok) setRecovery('sent')
  }

  const error = authErrorMessage(signIn.error, signIn.data, 'Une erreur est survenue lors de la connexion.')
  const requestError = authErrorMessage(requestReset.error, requestReset.data, 'Impossible d’envoyer le lien pour le moment.')

  if (recovery !== 'login') return (
    <YStack gap="$3">
      {recovery === 'unavailable' ? (
        <Text fontSize={14} color={palette.inkSecondary}>
          La récupération par e-mail n’est pas encore disponible. Contacte l’administrateur de ton serveur pour retrouver ton accès.
        </Text>
      ) : recovery === 'sent' ? (
        <YStack gap="$3">
          <Text fontSize={14} color={palette.inkSecondary} accessibilityLiveRegion="polite">
            {isFakeConnector ? 'Mode démo : aucun e-mail n’est envoyé.' : 'Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé. Vérifie aussi tes spams.'}
          </Text>
          {isFakeConnector ? <AuthButton label="Ouvrir le lien de démo" variant="secondary" onPress={() => router.push('/reset-password?token=demo')} testID="reset-demo-link" /> : null}
        </YStack>
      ) : (
        <>
          <Text fontSize={14} color={palette.inkSecondary}>Saisis ton e-mail pour recevoir un lien de réinitialisation.</Text>
          <AuthField label="Email" labelColor={palette.inkSecondary} placeholder="toi@exemple.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" testID="reset-email" />
          {requestError ? <AuthError message={requestError} /> : null}
          <AuthButton label="Recevoir un lien" pendingLabel="Envoi..." pending={requestReset.isPending} disabled={!trimmedEmail} onPress={handleRequestReset} testID="reset-request-submit" />
        </>
      )}
      <Pressable onPress={() => setRecovery('login')} accessibilityRole="button" accessibilityLabel="Retour à la connexion" style={[pointerCursor, { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingVertical: 8 }]}>
        <Text fontSize={13} fontWeight="700" color={palette.ink}>Retour à la connexion</Text>
      </Pressable>
    </YStack>
  )

  return (
    <YStack gap="$3">
      <AuthField
        label="Email"
        labelColor={palette.inkSecondary}
        placeholder="toi@exemple.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        testID="login-email"
      />
      <AuthPasswordField
        ref={passwordRef}
        label="Mot de passe"
        labelColor={palette.inkSecondary}
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        testID="login-password"
      />
      <Pressable
        onPress={() => setRecovery(resetAvailable ? 'request' : 'unavailable')}
        accessibilityRole="button"
        accessibilityLabel="Mot de passe oublié ?"
        style={[pointerCursor, { alignSelf: 'flex-end', minHeight: 48, justifyContent: 'center', paddingVertical: 8 }]}
      >
        <Text fontSize={13} fontWeight="700" color={palette.ink}>Mot de passe oublié ?</Text>
      </Pressable>
      {error ? <AuthError message={error} /> : null}
      <AuthButton
        label="Se connecter"
        pendingLabel="Connexion..."
        pending={signIn.isPending}
        disabled={!canSubmit}
        onPress={handleSubmit}
        testID="login-submit"
      />
    </YStack>
  )
}
