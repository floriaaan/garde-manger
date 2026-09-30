import type { ReactNode } from 'react'
import { Keyboard, View } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { PillButton } from '../shared/pill-button.js'
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
  const palette = useSoftPalette()
  return (
    <AuthScreenChrome maxWidth={440} hero={garden ? <AuthGardenHero /> : undefined}>
      {back}
      {mode && onModeChange && pages ? (
        <>
          {/* Keep both forms mounted so changing intent never erases a draft. */}
          {(['sign-in', 'sign-up'] as const).map((key) => {
            const page = key === 'sign-in' ? pages.signIn : pages.signUp
            return (
              <View key={key} style={{ display: mode === key ? 'flex' : 'none', gap: 20 }} accessibilityElementsHidden={mode !== key} importantForAccessibility={mode === key ? 'auto' : 'no-hide-descendants'}>
                <YStack gap={8}>
                  <Text accessibilityRole="header" fontSize={26} fontWeight="800" color={palette.ink}>{page.title}</Text>
                  <Text fontSize={15} color={palette.inkSecondary}>{page.subtitle}</Text>
                </YStack>
                {page.content}
              </View>
            )
          })}
          <YStack alignItems="center" gap={4}>
            <Text fontSize={14} color={palette.inkSecondary}>{mode === 'sign-up' ? 'Déjà un compte ?' : 'Pas encore de compte ?'}</Text>
            <PillButton testID={`auth-tab-${mode === 'sign-up' ? 'sign-in' : 'sign-up'}`} label={mode === 'sign-up' ? 'Se connecter' : 'Créer un compte'} tone="quiet" palette={palette} disabled={busy} onPress={() => { if (busy) return; Keyboard.dismiss(); onModeChange(mode === 'sign-up' ? 'sign-in' : 'sign-up') }} />
          </YStack>
        </>
      ) : (
        <>
          <YStack gap={8}>
            <Text accessibilityRole="header" fontSize={26} fontWeight="800" color={palette.ink}>{title}</Text>
            <Text fontSize={15} color={palette.inkSecondary}>{subtitle}</Text>
          </YStack>
          {children}
        </>
      )}
      {footer}
    </AuthScreenChrome>
  )
}
