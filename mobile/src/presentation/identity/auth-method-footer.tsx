import { useTranslation } from '../../i18n/index.js'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Image, Keyboard, View } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Text } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useSignInSocialMutation } from '../../application/identity/sign-in.mutation.js'
import { authErrorMessage } from './auth-error-message.js'
import { AuthKeyboardAccessory } from './auth-garden-theme.js'
import { AuthProviderButton } from './auth-provider-button.js'
import { AuthButton } from './auth-button.js'
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
  const { t } = useTranslation()
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
  const socialError = authErrorMessage(signInSocial.error, signInSocial.data, t('identity.couldn_t_sign_in_try_again_or_choose_another_method'))

  async function handlePocketId() {
    if (socialBusy) return
    setNativeError(null)
    setPendingProvider('pocketid')
    try {
      const result = await signInSocial.mutateAsync({ provider: 'pocketid' })
      if (result.ok && result.value) onSuccess()
    } catch {
      setNativeError(t('identity.couldn_t_sign_in_try_again_or_choose_another_method'))
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
      setNativeError(t('identity.couldn_t_sign_in_try_again_or_choose_another_method'))
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
      if (!credential.identityToken) throw new Error(t('identity.apple_didn_t_return_an_identity_token'))
      const result = await connector.signInApple(credential.identityToken)
      if (result.ok) onSuccess()
      else setNativeError(result.error.message)
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') && !(error instanceof Error && error.message.includes('ERR_REQUEST_CANCELED'))) {
        setNativeError(error instanceof Error ? error.message : t('identity.couldn_t_sign_in_with_apple'))
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
      setNativeError(error instanceof Error ? error.message : t('identity.couldn_t_sign_in_with_a_passkey'))
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
        {hasSocial ? <View testID="auth-social-methods" style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
          {apple ? <AuthProviderButton name="Apple" label={t('identity.continue_with_apple')} testID="auth-method-apple" icon={<Image source={require('../../../assets/images/sign-in-with-apple-logo.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />} pending={pendingNativeProvider === 'apple'} disabled={socialBusy} onPress={handleApple} /> : null}
          {google ? <AuthProviderButton name="Google" label={t('identity.continue_with_google')} testID="auth-method-google" icon={<GoogleIcon size={24} />} pending={pendingProvider === 'google'} disabled={socialBusy} onPress={handleGoogle} /> : null}
          {pocketId ? <AuthProviderButton name={pocketId.label} label={t('identity.continue_with', { value1: pocketId.label })} testID="auth-method-pocketid" icon={<PocketIdIcon size={24} color={palette.accentLimeText} />} pending={pendingProvider === 'pocketid'} disabled={socialBusy} onPress={handlePocketId} /> : null}
          {passkey ? <AuthProviderButton name="Clé d’accès" label={t('identity.use_a_passkey')} testID="auth-method-passkey" icon={<LockIcon size={24} color={palette.accentLimeText} />} pending={pendingNativeProvider === 'passkey'} disabled={socialBusy} onPress={handlePasskey} /> : null}
        </View> : null}
        {socialError ? <AuthError message={socialError} /> : null}
        {nativeError ? <AuthError message={nativeError} /> : null}
        {password && emailForm ? <AuthButton testID="auth-method-email" label={emailLabel} disabled={socialBusy} onPress={() => changeEmailMode(true)} /> : null}
      </View>
      {everEnteredEmail || emailActive ? (
        <View style={{ display: emailActive ? 'flex' : 'none', gap: 16 }} accessibilityElementsHidden={!emailActive} importantForAccessibility={emailActive ? 'auto' : 'no-hide-descendants'}>
          {hasSocial ? <AuthKeyboardAccessory><PillButton testID="auth-method-back" label={t('identity.another_method')} tone="quiet" palette={palette} disabled={socialBusy} icon={(color) => <ArrowLeftIcon size={16} color={color} />} onPress={() => changeEmailMode(false)} /></AuthKeyboardAccessory> : null}
          {emailForm}
        </View>
      ) : null}
    </View>
  )
}
