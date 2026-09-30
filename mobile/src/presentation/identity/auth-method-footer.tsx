import type { ReactNode } from 'react'
import { useState } from 'react'
import { Keyboard, View } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Text } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useSignInSocialMutation } from '../../application/identity/sign-in.mutation.js'
import { authErrorMessage } from './auth-error-message.js'
import { AuthButton } from './auth-button.js'
import { AuthDivider } from './auth-divider.js'
import { AuthError } from './auth-error.js'
import { PillButton } from '../shared/pill-button.js'
import { ArrowLeftIcon, LockIcon } from '../dashboard/dashboard-icons.js'
import { PocketIdIcon } from './pocket-id-icon.js'
import { GoogleIcon } from './google-icon.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { isFakeConnector } from '../../application/shared/connector-mode.js'

/** Named methods, natural-height forms, and drafts preserved when going back. */
export function AuthMethodFooter({ emailLabel, emailForm, onSuccess, allowPasskey = true, onEmailModeChange, disabled = false, onNativeBusyChange }: {
  emailLabel: string
  emailForm: ReactNode
  onSuccess: () => void
  allowPasskey?: boolean
  onEmailModeChange?: (active: boolean) => void
  disabled?: boolean
  onNativeBusyChange?: (busy: boolean) => void
}) {
  const connector = useConnector()
  const palette = useSoftPalette()
  const authMethods = useAuthMethodsQuery()
  const signInSocial = useSignInSocialMutation()
  const [mode, setMode] = useState<'choice' | 'email'>('choice')
  const [everEnteredEmail, setEverEnteredEmail] = useState(false)
  const [pendingNativeProvider, setPendingNativeProvider] = useState<'apple' | 'passkey' | null>(null)
  const [nativeError, setNativeError] = useState<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<'pocketid' | 'google' | null>(null)
  const pocketId = authMethods.data?.find((m) => m.id === 'pocketid' && m.enabled)
  const password = authMethods.data?.find((m) => m.id === 'password' && m.enabled)
  const google = authMethods.data?.find((m) => m.id === 'google' && m.enabled)
  const apple = authMethods.data?.find((m) => m.id === 'apple' && m.enabled)
  const passkey = authMethods.data?.find((m) => m.id === 'passkey' && m.enabled && allowPasskey)
  const hasSocial = Boolean(pocketId || google || apple || passkey)
  const emailActive = Boolean(password && emailForm && (mode === 'email' || !hasSocial))
  const socialBusy = disabled || pendingNativeProvider !== null || pendingProvider !== null || signInSocial.isPending
  const socialError = authErrorMessage(signInSocial.error, signInSocial.data, 'Connexion impossible. Réessaie ou choisis une autre méthode.')

  async function handlePocketId() {
    if (socialBusy) return
    setNativeError(null)
    setPendingProvider('pocketid')
    try {
      const result = await signInSocial.mutateAsync({ provider: 'pocketid' })
      if (result.ok && result.value) onSuccess()
    } catch {
      setNativeError('Connexion impossible. Réessaie ou choisis une autre méthode.')
    } finally {
      setPendingProvider(null)
    }
  }

  async function handleGoogle() {
    if (socialBusy) return
    setNativeError(null)
    setPendingProvider('google')
    try {
      const result = await signInSocial.mutateAsync({ provider: 'google' })
      if (result.ok && result.value) onSuccess()
    } catch {
      setNativeError('Connexion impossible. Réessaie ou choisis une autre méthode.')
    } finally {
      setPendingProvider(null)
    }
  }

  async function handleApple() {
    if (socialBusy) return
    setNativeError(null)
    setPendingNativeProvider('apple')
    onNativeBusyChange?.(true)
    try {
      if (isFakeConnector) {
        const result = await connector.signInApple('fake')
        if (result.ok) onSuccess()
        else setNativeError(result.error.message)
        return
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      })
      if (!credential.identityToken) throw new Error('Apple n’a pas renvoyé de jeton d’identité.')
      const result = await connector.signInApple(credential.identityToken)
      if (result.ok) onSuccess()
      else setNativeError(result.error.message)
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') && !(error instanceof Error && error.message.includes('ERR_REQUEST_CANCELED'))) {
        setNativeError(error instanceof Error ? error.message : 'Connexion Apple impossible.')
      }
    } finally {
      setPendingNativeProvider(null)
      onNativeBusyChange?.(false)
    }
  }

  async function handlePasskey() {
    if (socialBusy) return
    setNativeError(null)
    setPendingNativeProvider('passkey')
    onNativeBusyChange?.(true)
    try {
      const result = await connector.signInPasskey()
      if (result.ok) onSuccess()
      else if (result.error.type !== 'ERROR_CEREMONY_ABORTED') setNativeError(result.error.message)
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : 'Connexion par clé d’accès impossible.')
    } finally {
      setPendingNativeProvider(null)
      onNativeBusyChange?.(false)
    }
  }

  function changeEmailMode(active: boolean) {
    if (socialBusy) return
    Keyboard.dismiss()
    if (active) setEverEnteredEmail(true)
    setMode(active ? 'email' : 'choice')
    onEmailModeChange?.(active)
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ display: emailActive ? 'none' : 'flex', gap: 12 }} accessibilityElementsHidden={emailActive} importantForAccessibility={emailActive ? 'no-hide-descendants' : 'auto'}>
        {apple ? isFakeConnector ? (
          <AuthButton testID="auth-method-apple" label="Continuer avec Apple" pendingLabel="Connexion Apple…" pending={pendingNativeProvider === 'apple'} disabled={socialBusy} onPress={handleApple} variant="secondary" />
        ) : (
          <View pointerEvents={socialBusy ? 'none' : 'auto'} accessibilityState={{ busy: pendingNativeProvider === 'apple', disabled: socialBusy }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={allowPasskey ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={palette.blurTint === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={25}
              style={{ height: 50, width: '100%', opacity: socialBusy ? 0.6 : 1 }}
              onPress={handleApple}
            />
            {pendingNativeProvider === 'apple' ? <Text accessibilityLiveRegion="polite" fontSize={13} color={palette.inkSecondary}>Connexion Apple…</Text> : null}
          </View>
        ) : null}
        {google ? <AuthButton testID="auth-method-google" label="Continuer avec Google" pendingLabel="Connexion Google…" pending={pendingProvider === 'google'} disabled={socialBusy} onPress={handleGoogle} variant="secondary" icon={<GoogleIcon size={20} />} /> : null}
        {pocketId ? <AuthButton testID="auth-method-pocketid" label={pocketId.label} pendingLabel="Connexion…" pending={pendingProvider === 'pocketid'} disabled={socialBusy} onPress={handlePocketId} variant="secondary" icon={<PocketIdIcon size={20} color={palette.ink} />} /> : null}
        {passkey ? <AuthButton testID="auth-method-passkey" label="Utiliser une clé d’accès" pendingLabel="Vérification…" pending={pendingNativeProvider === 'passkey'} disabled={socialBusy} onPress={handlePasskey} variant="secondary" icon={<LockIcon size={20} color={palette.ink} />} /> : null}
        {socialError ? <AuthError message={socialError} /> : null}
        {nativeError ? <AuthError message={nativeError} /> : null}
        {password && emailForm ? <>{hasSocial ? <AuthDivider label="ou avec ton e-mail" /> : null}<AuthButton testID="auth-method-email" label={emailLabel} disabled={socialBusy} onPress={() => changeEmailMode(true)} /></> : null}
      </View>
      {everEnteredEmail || emailActive ? (
        <View style={{ display: emailActive ? 'flex' : 'none', gap: 16 }} accessibilityElementsHidden={!emailActive} importantForAccessibility={emailActive ? 'auto' : 'no-hide-descendants'}>
          {hasSocial ? <PillButton testID="auth-method-back" label="Autre méthode" tone="quiet" palette={palette} disabled={socialBusy} icon={(color) => <ArrowLeftIcon size={16} color={color} />} onPress={() => changeEmailMode(false)} /> : null}
          {emailForm}
        </View>
      ) : null}
    </View>
  )
}
