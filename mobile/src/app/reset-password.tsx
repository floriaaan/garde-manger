import { useTranslation } from '../i18n/index.js'
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
  const { t } = useTranslation()
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>()
  const palette = useSoftPalette()
  const reset = useResetPasswordMutation()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)
  const invalidLink = !token || Boolean(error)
  const validPassword = password.length >= 8 && password.length <= 128 && password === confirmation
  const resetError = authErrorMessage(reset.error, reset.data, t('navigation.couldn_t_reset_password'))

  async function submit() {
    if (!token || !validPassword) return
    const result = await reset.mutateAsync({ token, password })
    if (result.ok) setDone(true)
  }

  return (
    <AuthShell title={t('identity.new_password')} subtitle={t('navigation.regain_access_to_your_pantry')}>
      <YStack gap="$3">
        {done ? (
          <Text fontSize={14} color={palette.inkSecondary} accessibilityLiveRegion="polite">{t('navigation.your_password_has_been_changed_you_can_sign_in')}</Text>
        ) : invalidLink ? (
          <AuthError message={t('navigation.this_link_is_invalid_or_expired_request_a_new_link')} />
        ) : (
          <>
            <AuthPasswordField label={t('identity.new_password')} labelColor={palette.inkSecondary} placeholder="••••••••" value={password} onChangeText={setPassword} autoComplete="new-password" testID="reset-password" />
            <AuthPasswordField label={t('navigation.confirm_password')} labelColor={palette.inkSecondary} placeholder="••••••••" value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" testID="reset-confirmation" />
            <Text fontSize={12} color={palette.inkSecondary}>{t('identity.between_8_and_128_characters')}</Text>
            {confirmation && password !== confirmation ? <AuthError message={t('navigation.passwords_don_t_match')} /> : null}
            {resetError ? <AuthError message={resetError} /> : null}
            <AuthButton label={t('navigation.change_my_password')} pendingLabel={t('fridge.saving')} pending={reset.isPending} disabled={!validPassword} onPress={submit} testID="reset-submit" />
          </>
        )}
        <AuthButton label={t('identity.back_to_sign_in')} variant="secondary" onPress={() => router.replace('/(auth)/sign-in')} testID="reset-back" />
      </YStack>
    </AuthShell>
  )
}
