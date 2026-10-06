import { useTranslation } from '../../i18n/index.js'
import { Redirect, router } from 'expo-router'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { ActivityIndicator } from 'react-native'
import { Text } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
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

export function AuthEntryScreen({ initialMode = 'sign-in', successHref = '/(tabs)' }: {
  initialMode?: AuthMode
  successHref?: '/(tabs)' | '/subscription'
}) {
  const { t } = useTranslation()
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
    router.replace(successHref)
  }

  const footer = (
    <Pressable testID="auth-change-server" accessibilityRole="button" accessibilityLabel={t('identity.change_server')} accessibilityState={{ disabled: authBusy }} disabled={authBusy} onPress={() => { if (!authBusy) router.push({ pathname: '/server-choice', params: { next: mode } }) }} style={[pointerCursor, { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', opacity: authBusy ? 0.6 : 1 }]}>
      <Text fontSize={12} color={palette.inkSecondary}>
        {server === OFFICIAL_SERVER_URL ? t('debug.official_server') : server}
        {' · '}
        <Text fontSize={12} color={palette.inkSecondary} textDecorationLine="underline">{t('fridge.edit')}</Text>
      </Text>
    </Pressable>
  )

  if (session.data) return <Redirect href={successHref} />

  const title = mode === 'sign-up' ? t('identity.create_my_account') : t('identity.sign_in')
  const subtitle = mode === 'sign-up' ? t('identity.your_account_first_your_household_next') : t('identity.find_your_household_and_what_s_left_at_home')
  if (methods.isPending) return (
    <AuthShell title={title} subtitle={subtitle} footer={footer}>
      <ActivityIndicator color={palette.ink} />
      <Text accessibilityLiveRegion="polite" color={palette.inkSecondary}>{t('identity.looking_for_sign_in_methods')}</Text>
    </AuthShell>
  )
  if (methods.isError || !methods.data?.some((method) => method.enabled)) return (
    <AuthShell title={title} subtitle={subtitle} footer={footer}>
      <AuthError message={methods.isError ? t('identity.we_couldn_t_reach_this_server_try_again_or_change') : t('identity.no_sign_in_methods_are_available_on_this_server')} />
      <AuthButton testID="auth-method-retry" label={t('dashboard.try_again')} onPress={() => { void methods.refetch() }} />
    </AuthShell>
  )

  const hasPassword = methods.data.some((method) => method.id === 'password' && method.enabled)
  if (!hasPassword) return (
    <AuthShell title={t('identity.welcome_home')} subtitle={t('identity.choose_how_to_access_your_pantry')} garden footer={footer}>
      <AuthMethodFooter key={server} emailLabel={t('common.continue_with_email')} emailForm={null} onSuccess={handleSuccess} disabled={authBusy} onNativeBusyChange={setNativeBusy} />
    </AuthShell>
  )

  return (
    <AuthShell
      key={server}
      mode={mode}
      onModeChange={setMode}
      busy={authBusy}
      garden={!emailModes[mode]}
      footer={footer}
      pages={{
        signIn: {
          title: t('identity.sign_in'),
          subtitle: t('identity.find_your_household_and_what_s_left_at_home'),
          content: <AuthMethodFooter emailLabel={t('common.continue_with_email')} emailForm={<LoginForm onSuccess={handleSuccess} />} onSuccess={handleSuccess} disabled={authBusy} onNativeBusyChange={setNativeBusy} onEmailModeChange={(active) => setEmailModes((current) => ({ ...current, 'sign-in': active }))} />,
        },
        signUp: {
          title: t('identity.create_my_account'),
          subtitle: t('identity.your_account_first_your_household_next'),
          content: <AuthMethodFooter emailLabel={t('common.continue_with_email')} allowPasskey={false} emailForm={<SignupForm onSuccess={handleSuccess} />} onSuccess={handleSuccess} disabled={authBusy} onNativeBusyChange={setNativeBusy} onEmailModeChange={(active) => setEmailModes((current) => ({ ...current, 'sign-up': active }))} />,
        },
      }}
    />
  )
}
