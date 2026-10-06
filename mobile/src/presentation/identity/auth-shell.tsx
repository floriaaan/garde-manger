import { useTranslation } from '../../i18n/index.js'
import type { ReactNode } from 'react'
import { Keyboard } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
import { AuthStep } from './auth-step.js'
import { AuthKeyboardAccessory } from './auth-garden-theme.js'
import { AuthGardenHero, AuthScreenChrome } from './auth-screen-chrome.js'

export type AuthMode = 'sign-in' | 'sign-up'
interface AuthPage { title: string; subtitle: string; content: ReactNode }

export function AuthShell({ title, subtitle, mode, onModeChange, pages, children, garden = false, footer, back, busy = false }: {
  title?: string
  subtitle?: string
  mode?: AuthMode
  onModeChange?: (mode: AuthMode) => void
  pages?: { signIn: AuthPage; signUp: AuthPage }
  children?: ReactNode
  garden?: boolean
  footer?: ReactNode
  back?: ReactNode
  busy?: boolean
}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  return (
    <AuthScreenChrome maxWidth={440} hero={garden ? <AuthGardenHero /> : undefined}>
      <AuthKeyboardAccessory>{back}</AuthKeyboardAccessory>
      {mode && onModeChange && pages ? (
        <>
          {/* Keep both forms mounted so changing intent never erases a draft. */}
          {(['sign-in', 'sign-up'] as const).map((key) => {
            const page = key === 'sign-in' ? pages.signIn : pages.signUp
            return (
              <AuthStep key={key} active={mode === key} direction={key === 'sign-up' ? 1 : -1} style={{ gap: 20 }}>
                <AuthKeyboardAccessory><YStack gap={8}>
                  <Text accessibilityRole="header" fontSize={28} fontWeight="800" letterSpacing={-0.6} color={palette.ink}>{page.title}</Text>
                  {!garden ? <Text fontSize={15} color={palette.inkSecondary}>{page.subtitle}</Text> : null}
                </YStack></AuthKeyboardAccessory>
                {page.content}
              </AuthStep>
            )
          })}
          <AuthKeyboardAccessory><Pressable testID={`auth-tab-${mode === 'sign-up' ? 'sign-in' : 'sign-up'}`} accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { if (busy) return; Keyboard.dismiss(); onModeChange(mode === 'sign-up' ? 'sign-in' : 'sign-up') }} style={[pointerCursor, { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', opacity: busy ? 0.6 : 1 }]}>
            <Text fontSize={14} color={palette.ink}>
              {mode === 'sign-up' ? t('identity.already_have_an_account') : t('identity.don_t_have_an_account_yet')}
              <Text fontSize={14} fontWeight="800" textDecorationLine="underline" color={palette.ink}>{mode === 'sign-up' ? t('identity.sign_in') : t('identity.create_an_account')}</Text>
            </Text>
          </Pressable></AuthKeyboardAccessory>
        </>
      ) : (
        <>
          <AuthKeyboardAccessory><YStack gap={8}>
            <Text accessibilityRole="header" fontSize={26} fontWeight="800" color={palette.ink}>{title}</Text>
            <Text fontSize={15} color={palette.inkSecondary}>{subtitle}</Text>
          </YStack></AuthKeyboardAccessory>
          {children}
        </>
      )}
      <AuthKeyboardAccessory>{footer}</AuthKeyboardAccessory>
    </AuthScreenChrome>
  )
}
