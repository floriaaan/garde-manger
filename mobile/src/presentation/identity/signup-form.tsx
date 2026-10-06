import { useTranslation } from '../../i18n/index.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, View, useWindowDimensions, type TextInput } from 'react-native'
import zxcvbn from 'zxcvbn'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useSignUpMutation } from '../../application/identity/sign-up.mutation.js'
import { authErrorMessage } from './auth-error-message.js'
import { AuthKeyboardAccessory, useAuthEntryLayout } from './auth-garden-theme.js'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
import { AuthButton } from './auth-button.js'
import { AuthError } from './auth-error.js'
import { AuthField } from './auth-field.js'
import { AuthPasswordField } from './auth-password-field.js'

export function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const { keyboardOpen, availableHeight } = useAuthEntryLayout()
  const { fontScale } = useWindowDimensions()
  // Keep every web field in the tab order, including on short windows.
  const compactForm = Platform.OS !== 'web' && availableHeight > 0 && availableHeight < (keyboardOpen ? 470 : 740) * fontScale
  const [field, setField] = useState<'name' | 'email' | 'password'>('name')
  const nameRef = useRef<TextInput>(null)
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  useEffect(() => {
    if (!compactForm || !keyboardOpen) return
    const next = field === 'name' ? nameRef : field === 'email' ? emailRef : passwordRef
    next.current?.focus()
  }, [field, compactForm, keyboardOpen])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signUp = useSignUpMutation()

  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  // Not password.trim() — see login-form.tsx's own note.
  const canSubmit = trimmedName.length > 0 && trimmedEmail.length > 0 && password.length >= 8 && password.length <= 128
  const strength = useMemo(
    () => password ? zxcvbn(password.slice(0, 100), [trimmedName, trimmedEmail]).score : 0,
    [password, trimmedName, trimmedEmail],
  )
  const strengthLabels = [t('identity.very_weak'), t('identity.weak'), t('identity.fair'), t('identity.good'), t('identity.very_good')]
  const strengthColors = [palette.expired, palette.expired, palette.soon, palette.fresh, palette.fresh]

  async function handleSubmit() {
    if (!canSubmit || signUp.isPending) return
    const result = await signUp.mutateAsync({ email: trimmedEmail, password, name: trimmedName })
    if (result.ok) onSuccess()
  }

  const error = authErrorMessage(signUp.error, signUp.data, t('identity.an_error_occurred_while_signing_up'))

  return (
    <YStack gap={keyboardOpen ? 8 : '$3'}>
      <View style={{ display: !compactForm || field === 'name' ? 'flex' : 'none' }}>
      <AuthField
        ref={nameRef}
        onFocus={() => setField('name')}
        label={t('fridge.name')}
        labelColor={palette.inkSecondary}
        placeholder={t('identity.your_first_name')}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => { if (!trimmedName) return; setField('email'); if (!compactForm) emailRef.current?.focus() }}
        testID="signup-name"
      />
      </View>
      <View style={{ display: !compactForm || field === 'email' ? 'flex' : 'none' }}>
      <AuthField
        onFocus={() => setField('email')}
        ref={emailRef}
        label={t('identity.email_2')}
        labelColor={palette.inkSecondary}
        placeholder={t('identity.you_example_com')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => { if (!trimmedEmail) return; setField('password'); if (!compactForm) passwordRef.current?.focus() }}
        testID="signup-email"
      />
      </View>
      <View style={{ display: !compactForm || field === 'password' ? 'flex' : 'none' }}>
      <AuthPasswordField
        onFocus={() => setField('password')}
        ref={passwordRef}
        label={t('identity.password')}
        labelColor={palette.inkSecondary}
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        testID="signup-password"
      />
      </View>
      {!compactForm || field === 'password' ? <>
      <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>{t('identity.between_8_and_128_characters')}</Text>
      <AuthKeyboardAccessory>{password ? (
        <YStack gap="$1" accessibilityLabel={t('identity.password_strength', { value1: strengthLabels[strength] })}>
          <XStack gap="$1">
            {[0, 1, 2, 3, 4].map((segment) => (
              <YStack key={segment} flex={1} height={5} borderRadius={999} backgroundColor={segment <= strength ? strengthColors[strength] : palette.heroPillFill} />
            ))}
          </XStack>
          <Text fontSize={12} fontWeight="700" color={palette.inkSecondary}>
            {t('identity.password_strength', { value1: strengthLabels[strength] })}
          </Text>
        </YStack>
      ) : null}</AuthKeyboardAccessory>
      </> : null}
      {error ? <AuthError message={error} /> : null}
      <AuthButton
        label={compactForm && field !== 'password' ? t('identity.continue') : t('identity.create_my_account')}
        pendingLabel={t('identity.signing_up')}
        pending={signUp.isPending}
        disabled={signUp.isPending || (compactForm && field === 'name' ? !trimmedName : compactForm && field === 'email' ? !trimmedEmail : !canSubmit)}
        onPress={() => { if (compactForm && field !== 'password') setField(field === 'name' ? 'email' : 'password'); else void handleSubmit() }}
        testID="signup-submit"
      />
      {compactForm && field !== 'name' ? <Pressable testID="signup-previous-field" accessibilityRole="button" accessibilityLabel={t('identity.go_back_to_the_previous_field')} disabled={signUp.isPending} onPress={() => setField(field === 'password' ? 'email' : 'name')} style={[pointerCursor, { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }]}>
        <Text fontSize={13} fontWeight="700" color={palette.ink}>{t('identity.back')}</Text>
      </Pressable> : null}
    </YStack>
  )
}
