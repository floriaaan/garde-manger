/**
 * The footer's own two-state body: a method chooser (just buttons — no
 * fields grab focus before the visitor has said which method they want),
 * expanding into the chosen method's form. Only "e-mail" has anything to
 * expand into; PocketID fires its social flow straight from the chooser, so
 * choosing it never leaves the collapsed state at all.
 *
 * Both states stay mounted once the e-mail form has been entered once —
 * toggled with `display: 'none'`, not conditional JSX — instead of
 * unmounting `emailForm` on every "back to chooser" tap. It used to
 * unmount, which silently discarded whatever the visitor had already typed
 * the moment they tapped a barely-visible link by accident; `display` keeps
 * `LoginForm`/`SignupForm`'s own state alive underneath. The form still
 * never mounts at all until "e-mail" is chosen the first time — nothing
 * grabs focus before that.
 *
 * The height animates between the two states rather than cutting — measured
 * from the real, currently-mounted content (`onLayout`) rather than a
 * guessed pixel constant, so neither state can ever clip: an error line
 * wrapping to two lines, or the PocketID button appearing once
 * `useAuthMethodsQuery` resolves, both replay the same tween because they
 * go through the same measured-height path a mode switch does. A
 * `display: 'none'` sibling contributes nothing to that measurement, the
 * same way it contributes nothing to layout generally.
 *
 * Visibility never depends on `onLayout` actually firing: the content sits
 * in a plain, unconstrained `View` until the *first* measurement lands, so
 * it renders at its natural size — and is therefore never blank — before
 * that measurement exists. Only once a height is known does the wrapping
 * `Animated.View` start constraining to it, at the value just measured, so
 * there is no jump the moment animation control takes over.
 */
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { Animated, Easing, Image, Pressable, View } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, pressAreaSlop, useReduceMotion } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ripple } from '../shared/material.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useSignInSocialMutation } from '../../application/identity/sign-in.mutation.js'
import { authErrorMessage } from './auth-error-message.js'
import { AuthButton } from './auth-button.js'
import { AuthDivider } from './auth-divider.js'
import { AuthError } from './auth-error.js'
import { PillButton } from '../shared/pill-button.js'
import { ArrowLeftIcon } from '../dashboard/dashboard-icons.js'
import { PocketIdIcon } from './pocket-id-icon.js'
import { GoogleIcon } from './google-icon.js'
import { AuthProviderButton } from './auth-provider-button.js'
import { LockIcon } from '../dashboard/dashboard-icons.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { isFakeConnector } from '../../application/shared/connector-mode.js'

type Mode = 'choice' | 'email'

export function AuthMethodFooter({
  emailLabel,
  emailForm,
  onSuccess,
  allowPasskey = true,
}: {
  /** The chooser's own e-mail button label — "Continuer avec e-mail" (sign-in), "Créer un compte avec e-mail" (sign-up). */
  emailLabel: string
  /** `<LoginForm .../>` or `<SignupForm .../>` — mounted only once "e-mail" is chosen. */
  emailForm: ReactNode
  onSuccess: () => void
  allowPasskey?: boolean
}) {
  const connector = useConnector()
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const authMethods = useAuthMethodsQuery()
  const signInSocial = useSignInSocialMutation()
  const [mode, setMode] = useState<Mode>('choice')
  const [everEnteredEmail, setEverEnteredEmail] = useState(false)
  const [height] = useState(() => new Animated.Value(0))
  const [hasMeasured, setHasMeasured] = useState(false)
  const [pendingNativeProvider, setPendingNativeProvider] = useState<'apple' | 'passkey' | null>(null)
  const [nativeError, setNativeError] = useState<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<'pocketid' | 'google' | null>(null)
  const [methodHint, setMethodHint] = useState<string | null>(null)

  const pocketId = authMethods.data?.find((m) => m.id === 'pocketid' && m.enabled)
  const password = authMethods.data?.find((m) => m.id === 'password' && m.enabled)
  const google = authMethods.data?.find((m) => m.id === 'google' && m.enabled)
  const apple = authMethods.data?.find((m) => m.id === 'apple' && m.enabled)
  const passkey = authMethods.data?.find((m) => m.id === 'passkey' && m.enabled && allowPasskey)
  const hasSocial = Boolean(pocketId || google || apple || passkey)
  const compactSocial = [password, pocketId, google, apple, passkey].filter(Boolean).length > 2
  const nativePending = pendingNativeProvider !== null
  const socialBusy = nativePending || signInSocial.isPending
  const socialError = authErrorMessage(signInSocial.error, signInSocial.data, 'Une erreur est survenue lors de la connexion.')

  const onMeasure = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height
      if (!hasMeasured) {
        // Landing on the exact size the unconstrained box was already
        // rendering at — switching to animation control here causes no
        // visible jump, first render or not.
        height.setValue(next)
        setHasMeasured(true)
        return
      }
      if (reduceMotion) {
        height.setValue(next)
        return
      }
      Animated.timing(height, { toValue: next, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    },
    [hasMeasured, height, reduceMotion],
  )

  async function handlePocketId() {
    setPendingProvider('pocketid')
    try {
      const result = await signInSocial.mutateAsync({ provider: 'pocketid' })
      if (result.ok && result.value) onSuccess()
    } finally {
      setPendingProvider(null)
    }
  }

  async function handleGoogle() {
    setPendingProvider('google')
    try {
      const result = await signInSocial.mutateAsync({ provider: 'google' })
      if (result.ok && result.value) onSuccess()
    } finally {
      setPendingProvider(null)
    }
  }

  async function handleApple() {
    if (nativePending) return
    setNativeError(null)
    setPendingNativeProvider('apple')
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
      if (!(error instanceof Error && error.message.includes('ERR_REQUEST_CANCELED'))) {
        setNativeError(error instanceof Error ? error.message : 'Connexion Apple impossible.')
      }
    } finally {
      setPendingNativeProvider(null)
    }
  }

  async function handlePasskey() {
    if (nativePending) return
    setNativeError(null)
    setPendingNativeProvider('passkey')
    try {
      const result = await connector.signInPasskey()
      if (result.ok) onSuccess()
      else if (result.error.type !== 'ERROR_CEREMONY_ABORTED') setNativeError(result.error.message)
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : 'Connexion par clé d’accès impossible.')
    } finally {
      setPendingNativeProvider(null)
    }
  }

  function chooseEmail() {
    setEverEnteredEmail(true)
    setMode('email')
  }

  return (
    <Animated.View style={hasMeasured ? { height, overflow: 'hidden' } : undefined}>
      <View onLayout={onMeasure} style={{ gap: 12 }}>
        <View style={{ display: mode === 'choice' ? 'flex' : 'none', gap: 12 }}>
          {password ? <AuthButton testID="auth-method-email" label={emailLabel} onPress={chooseEmail} /> : null}
          {hasSocial ? (
            <>
              {password ? <AuthDivider label="ou" /> : null}
              {socialError ? <AuthError message={socialError} /> : null}
              {nativeError ? <AuthError message={nativeError} /> : null}
              {compactSocial ? (
                <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
                  {apple ? (
                    <AuthProviderButton
                      label="Continuer avec Apple"
                      testID="auth-method-apple"
                      icon={<Image source={require('../../../assets/images/sign-in-with-apple-logo.png')} style={{ width: 44, height: 44 }} />}
                      onPress={handleApple}
                      pending={pendingNativeProvider === 'apple'}
                      disabled={socialBusy}
                      surface="white"
                      onHint={setMethodHint}
                    />
                  ) : null}
                  {google ? (
                    <AuthProviderButton
                      label="Continuer avec Google"
                      testID="auth-method-google"
                      icon={<GoogleIcon size={24} />}
                      onPress={handleGoogle}
                      pending={pendingProvider === 'google'}
                      disabled={socialBusy}
                      onHint={setMethodHint}
                    />
                  ) : null}
                  {pocketId ? (
                    <AuthProviderButton
                      label="Continuer avec PocketID"
                      testID="auth-method-pocketid"
                      icon={<PocketIdIcon size={24} color={palette.accentLimeText} />}
                      onPress={handlePocketId}
                      pending={pendingProvider === 'pocketid'}
                      disabled={socialBusy}
                      onHint={setMethodHint}
                    />
                  ) : null}
                  {passkey ? (
                    <AuthProviderButton
                      label="Utiliser une clé d’accès"
                      testID="auth-method-passkey"
                      icon={<LockIcon size={24} color={palette.accentLimeText} />}
                      onPress={handlePasskey}
                      pending={pendingNativeProvider === 'passkey'}
                      disabled={socialBusy}
                      onHint={setMethodHint}
                    />
                  ) : null}
                </View>
              ) : apple && isFakeConnector ? (
                <AuthButton
                  testID="auth-method-apple"
                  label="Continuer avec Apple"
                  pending={nativePending}
                  onPress={handleApple}
                  variant="secondary"
                  tone="on-dark"
                />
              ) : apple ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={allowPasskey ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={25}
                  style={{ height: 50, width: '100%', opacity: nativePending ? 0.6 : 1 }}
                  onPress={handleApple}
                />
              ) : null}
              {compactSocial && methodHint ? (
                <Text fontSize={12} fontWeight="700" color={palette.onDarkSecondary} textAlign="center" accessibilityLiveRegion="polite">
                  {methodHint}
                </Text>
              ) : null}
              {!compactSocial && passkey ? (
                <AuthButton
                  testID="auth-method-passkey"
                  label="Continuer avec une clé d’accès"
                  pending={nativePending}
                  onPress={handlePasskey}
                  variant="secondary"
                  tone="on-dark"
                />
              ) : null}
              {!compactSocial && pocketId ? (
                <AuthButton
                  testID="auth-method-pocketid"
                  label={pocketId.label}
                  pendingLabel="Connexion..."
                  pending={signInSocial.isPending}
                  onPress={handlePocketId}
                  variant="secondary"
                  tone="on-dark"
                  icon={<PocketIdIcon size={18} color={palette.accentLimeText} />}
                />
              ) : null}
              {!compactSocial && google ? (
                <AuthButton
                  testID="auth-method-google"
                  label={google.label}
                  pendingLabel="Connexion..."
                  pending={signInSocial.isPending}
                  onPress={handleGoogle}
                  variant="secondary"
                  tone="on-dark"
                  icon={<GoogleIcon size={18} />}
                />
              ) : null}
            </>
          ) : authMethods.isError ? (
            // Loading, "nothing configured", and "couldn't check" all used to
            // render the same way here: nothing. A household that actually
            // relies on PocketID and hits a flaky connection has no way to
            // tell those apart from this row alone.
            <YStack gap="$2">
              <AuthDivider label="ou" />
              <AuthError message="Impossible de vérifier les méthodes de connexion disponibles." />
              <PillButton
                testID="auth-method-retry"
                label="Réessayer"
                tone="quiet"
                size="dense"
                palette={palette}
                onPress={() => authMethods.refetch()}
              />
            </YStack>
          ) : null}
        </View>

        {everEnteredEmail ? (
          <View style={{ display: mode === 'email' ? 'flex' : 'none', gap: 12 }}>
            <Pressable
              testID="auth-method-back"
              onPress={() => setMode('choice')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              android_ripple={ripple(palette.onDarkSecondary, { borderless: true })}
              accessibilityRole="button"
              accessibilityLabel="Choisir une autre méthode de connexion"
              style={[
                pointerCursor,
                pressAreaSlop(8, 8),
                { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
              ]}
            >
              <ArrowLeftIcon size={14} color={palette.onDarkSecondary} />
              <Text fontSize={13} fontWeight="700" color={palette.onDarkSecondary}>
                Autre méthode
              </Text>
            </Pressable>
            {emailForm}
          </View>
        ) : null}
      </View>
    </Animated.View>
  )
}
