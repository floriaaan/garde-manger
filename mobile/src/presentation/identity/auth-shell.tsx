import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Animated, Easing, KeyboardAvoidingView, PixelRatio, Platform, ScrollView, useWindowDimensions } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReduceMotion } from '../shared/hover.js'
import { HeroWarmGlow } from '../dashboard/hero-warm-glow.js'
import { AuthPhotoBackground } from './auth-photo-background.js'
import { AuthWordmark } from './auth-wordmark.js'

// Plain padding here, not `SafeAreaView`'s edges — see the note this used to
// carry about a suspected native-measurement collapse. That theory did not
// hold up (removing it changed nothing for the reporter), but the fullscreen-
// on-focus feature built on top of it clearly broke something real, and
// rolling all the way back to this simpler, static panel — no focus-driven
// grow, no context, no per-render style-array branching — is the fastest
// way to hand back a working sign-in/sign-up while that feature gets
// re-approached and actually verified on a device before shipping again.
const BOTTOM_INSET_FALLBACK = Platform.select({ ios: 24, default: 12 })
/** Same cap `tonight-rail.tsx` and `WelcomeScreen` use for their own scaled `lineHeight`s. */
const MAX_FONT_SCALE = 1.6

/**
 * Sign-in/sign-up's shell — the warm kitchen photo (same image the welcome
 * screen opens on) behind a bottom hero panel, built exactly like the
 * welcome screen's own panel: photo zone at `flex:1`, panel sized to its
 * own content below it.
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
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const { height: windowHeight } = useWindowDimensions()
  const panelMaxHeight = Math.round(windowHeight * 0.78)
  const fontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE)
  const [entrance] = useState(() => new Animated.Value(reduceMotion ? 1 : 0))

  useEffect(() => {
    if (reduceMotion) return
    Animated.timing(entrance, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [entrance, reduceMotion])

  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.brandDeep}>
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <YStack flex={1} minHeight={0} style={{ position: 'relative' }}>
          <AuthPhotoBackground />
          <YStack paddingTop={Platform.select({ ios: 50, default: 24 })}>
            <AuthWordmark tone="on-dark" />
          </YStack>
        </YStack>

        <YStack
          backgroundColor={palette.brandDeep}
          overflow="hidden"
          style={{ position: 'relative', borderTopLeftRadius: 36, borderTopRightRadius: 20 }}
        >
          <HeroWarmGlow warm={palette.accentWarm} ground={palette.brandDeep} />
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ maxHeight: panelMaxHeight }}>
            <Animated.View
              style={{
                opacity: entrance,
                transform: [{ translateY: reduceMotion ? 0 : entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                paddingHorizontal: 28,
                paddingTop: 32,
                paddingBottom: 20 + BOTTOM_INSET_FALLBACK,
                gap: 20,
              }}
            >
              <YStack gap="$1">
                <Text fontSize={24} fontWeight="800" lineHeight={30 * fontScale} color={palette.onDark}>
                  {title}
                </Text>
                {/* `body`'s own 14px (DESIGN.md), not a bespoke 13px — this
                    and the welcome screen's subtitle used to disagree with
                    each other and with the token both were meant to be. */}
                <Text fontSize={14} fontWeight="500" lineHeight={20 * fontScale} color={palette.onDarkSecondary}>
                  {subtitle}
                </Text>
              </YStack>
              {children}
            </Animated.View>
          </ScrollView>
        </YStack>
      </KeyboardAvoidingView>
    </YStack>
  )
}
