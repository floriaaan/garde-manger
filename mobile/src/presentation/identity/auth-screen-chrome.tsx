import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { AuthBlobBackground } from './auth-blob-background.js'
import { AuthWordmark } from './auth-wordmark.js'

/**
 * The chrome the threshold screen uses: blob ground, safe area,
 * keyboard-avoiding scroll, and the carrot+wordmark lockup above the content.
 * Sign-in/sign-up moved off this (see `AuthShell`, now a bottom hero panel
 * over a photo rather than a centered card) once their own interaction
 * outgrew "one static card, vertically centered" — this remains exactly
 * that for the one screen still shaped like it.
 */
export function AuthScreenChrome({
  maxWidth,
  overlay,
  children,
}: {
  /** The lockup+content column's cap — narrower for a single card, wider for two. */
  maxWidth: number
  /**
   * Rendered as a sibling of the safe area, inside the outer `position:
   * relative` flex fill — not inside the scroll content. A `HintBubble`
   * positions itself `absolute` against that fill; nested inside the
   * scrolling column instead, it would anchor to the content height rather
   * than the screen.
   */
  overlay?: ReactNode
  children: ReactNode
}) {
  const palette = useSoftPalette()
  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <AuthBlobBackground />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1, minHeight: 0 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <YStack width="100%" maxWidth={maxWidth} gap="$5">
              <AuthWordmark tone="ink" />
              {children}
            </YStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {overlay}
    </YStack>
  )
}
