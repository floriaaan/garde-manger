import { useEffect, useRef, useState } from 'react'
import { View, useWindowDimensions, type TextInput } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useSignInEmailMutation } from '../../application/identity/sign-in.mutation.js'
import { authErrorMessage } from './auth-error-message.js'
import { AuthKeyboardAccessory, useAuthEntryLayout } from './auth-garden-theme.js'
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
  const { keyboardOpen, availableHeight } = useAuthEntryLayout()
  const { fontScale } = useWindowDimensions()
  const compactForm = availableHeight > 0 && availableHeight < (keyboardOpen ? 410 : 560) * fontScale
  const [field, setField] = useState<'email' | 'password'>('email')
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  useEffect(() => {
    if (compactForm && keyboardOpen) (field === 'email' ? emailRef : passwordRef).current?.focus()
  }, [field, compactForm, keyboardOpen])
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
    <YStack gap={keyboardOpen ? 8 : '$3'}>
      {recovery === 'unavailable' ? (
        <Text fontSize={14} color={palette.inkSecondary}>
          La récupération par e-mail n’est pas encore disponible. Contacte l’administrateur de ton serveur pour retrouver ton accès.
        </Text>
      ) : recovery === 'sent' ? (
        <YStack gap={keyboardOpen ? 8 : '$3'}>
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
    <YStack gap={keyboardOpen ? 8 : '$3'}>
      <View style={{ display: !compactForm || field === 'email' ? 'flex' : 'none' }}>
      <AuthField
        ref={emailRef}
        onFocus={() => setField('email')}
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
        onSubmitEditing={() => { if (!trimmedEmail) return; setField('password'); if (!compactForm) passwordRef.current?.focus() }}
        testID="login-email"
      />
      </View>
      <View style={{ display: !compactForm || field === 'password' ? 'flex' : 'none' }}>
      <AuthPasswordField
        onFocus={() => setField('password')}
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
      </View>
      <AuthKeyboardAccessory><Pressable
        onPress={() => setRecovery(resetAvailable ? 'request' : 'unavailable')}
        accessibilityRole="button"
        accessibilityLabel="Mot de passe oublié ?"
        style={[pointerCursor, { alignSelf: 'flex-end', minHeight: 48, justifyContent: 'center', paddingVertical: 8 }]}
      >
        <Text fontSize={13} fontWeight="700" color={palette.ink}>Mot de passe oublié ?</Text>
      </Pressable></AuthKeyboardAccessory>
      {error ? <AuthError message={error} /> : null}
      <AuthButton
        label={compactForm && field === 'email' ? 'Continuer' : 'Se connecter'}
        pendingLabel="Connexion..."
        pending={signIn.isPending}
        disabled={signIn.isPending || (compactForm && field === 'email' ? !trimmedEmail : !canSubmit)}
        onPress={() => { if (compactForm && field === 'email') setField('password'); else void handleSubmit() }}
        testID="login-submit"
      />
      {compactForm && field === 'password' ? <Pressable testID="login-previous-field" accessibilityRole="button" accessibilityLabel="Revenir à l’e-mail" disabled={signIn.isPending} onPress={() => setField('email')} style={[pointerCursor, { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }]}>
        <Text fontSize={13} fontWeight="700" color={palette.ink}>Retour à l’e-mail</Text>
      </Pressable> : null}
    </YStack>
  )
}
