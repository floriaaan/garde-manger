import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Keyboard, KeyboardAvoidingView, PixelRatio, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReduceMotion } from '../shared/hover.js'
import { HeroWarmGlow } from '../dashboard/hero-warm-glow.js'
import { AuthPhotoBackground } from './auth-photo-background.js'
import { AuthWordmark } from './auth-wordmark.js'
import { AuthModePager, type AuthMode, type AuthPage } from './auth-mode-pager.js'

/** Same cap `tonight-rail.tsx` and `WelcomeScreen` use for their own scaled `lineHeight`s. */
const MAX_FONT_SCALE = 1.6

/**
 * Sign-in/sign-up's shell — the warm kitchen photo (same image the welcome
 * screen opens on) behind a bottom hero panel. On narrow screens it fills
 * the space above the panel, preserving the photo's composition; on wide
 * screens it fills the whole screen beside the centered half-width panel.
 *
 * Not `AuthScreenChrome`: this stopped being "one static card, vertically
 * centered" once the footer's own method-chooser needed to grow after a tap
 * (see `AuthMethodFooter`), and the threshold screen (still exactly that)
 * keeps `AuthScreenChrome` for itself.
 *
 * The panel is the hero card's own geometry, at screen scale — see
 * `WelcomeScreen`'s file comment for why it keeps only the top corner pair
 * and skips the hero-lift shadow: both exist to separate a floating card
 * from the ground around it, and this panel is flush to three of the four
 * screen edges.
 */
export function AuthShell({
  title,
  subtitle,
  mode,
  onModeChange,
  pages,
  children,
}: {
  title?: string
  subtitle?: string
  mode?: AuthMode
  onModeChange?: (mode: AuthMode) => void
  pages?: { signIn: AuthPage; signUp: AuthPage }
  children?: ReactNode
}) {
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const { height: windowHeight, width: windowWidth } = useWindowDimensions()
  const isWide = windowWidth >= 768
  const panelWidth = isWide ? windowWidth / 2 : windowWidth
  const panelMaxHeight = Math.round(windowHeight * 0.78)
  const fontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE)
  const [entrance] = useState(() => new Animated.Value(reduceMotion ? 1 : 0))
  const scrollRef = useRef<ScrollView>(null)

  function changeMode(nextMode: AuthMode) {
    if (!mode || !onModeChange || nextMode === mode) return
    Keyboard.dismiss()
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion })
    onModeChange(nextMode)
  }

  useEffect(() => {
    if (reduceMotion) return
    Animated.timing(entrance, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [entrance, reduceMotion])

  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.brandDeep} style={{ position: 'relative' }}>
      {isWide ? <AuthPhotoBackground /> : null}
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <YStack flex={1} minHeight={0} style={{ position: 'relative' }}>
          {!isWide ? <AuthPhotoBackground /> : null}
          <SafeAreaView edges={['top', 'left', 'right']} style={{ paddingTop: 16, paddingHorizontal: 24 }}>
            <AuthWordmark tone="on-dark" />
          </SafeAreaView>
        </YStack>

        <YStack
          backgroundColor={palette.brandDeep}
          overflow="hidden"
          style={{ position: 'relative', borderTopLeftRadius: 36, borderTopRightRadius: 20, width: panelWidth, alignSelf: 'center' }}
        >
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderTopLeftRadius: 36, borderTopRightRadius: 20 }]}>
            <HeroWarmGlow warm={palette.accentWarm} ground={palette.brandDeep} />
          </View>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" bounces={false} style={{ maxHeight: panelMaxHeight }}>
            <SafeAreaView edges={['bottom']}>
              <Animated.View
                style={{
                  opacity: entrance,
                  transform: [{ translateY: reduceMotion ? 0 : entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                  paddingHorizontal: 28,
                  paddingTop: 32,
                  paddingBottom: 20,
                  gap: 20,
                }}
              >
                {mode && onModeChange && pages ? (
                  <AuthModePager
                    mode={mode}
                    onModeChange={changeMode}
                    pages={pages}
                    width={panelWidth - 56}
                    fontScale={fontScale}
                    reduceMotion={reduceMotion}
                    palette={palette}
                  />
                ) : (
                  <>
                    <YStack gap="$1">
                      <Text fontSize={24} fontWeight="800" lineHeight={30 * fontScale} color={palette.onDark}>
                        {title}
                      </Text>
                      <Text fontSize={14} fontWeight="500" lineHeight={20 * fontScale} color={palette.onDarkSecondary}>
                        {subtitle}
                      </Text>
                    </YStack>
                    {children}
                  </>
                )}
              </Animated.View>
            </SafeAreaView>
          </ScrollView>
        </YStack>
      </KeyboardAvoidingView>
    </YStack>
  )
}
