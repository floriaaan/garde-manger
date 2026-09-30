import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Image, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text as NativeText, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold'
import Svg, { Path } from 'react-native-svg'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { AuthWordmark } from './auth-wordmark.js'
import { AuthEntryLayoutContext, AuthGardenContext, gardenColors, useAuthEntryLayout } from './auth-garden-theme.js'

/** The approved comp's edge-to-edge field, oversized lettering and photographic overlap. */
export function AuthGardenHero({ compact = false, title, subtitle }: { compact?: boolean; title?: string; subtitle?: string }) {
  const colors = gardenColors(useSoftPalette())
  const { heroSpace } = useAuthEntryLayout()
  const [textHeight, setTextHeight] = useState(0)
  const { width, fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const wide = width >= 768
  const [heroWidth, setHeroWidth] = useState(wide ? Math.min(width - 64, 1040) / 2 : Math.min(width, 600))
  const [measurementKey, setMeasurementKey] = useState('')
  const [loaded] = useFonts({
    GardenDisplay: require('../../../assets/fonts/Anton-Regular.ttf'),
    GardenWordmark: PlusJakartaSans_800ExtraBold,
  })
  const nextMeasurementKey = [width, fontScale, compact, title, subtitle, loaded].join('|')
  if (measurementKey !== nextMeasurementKey) {
    setMeasurementKey(nextMeasurementKey)
    setTextHeight(0)
    setHeroWidth(wide ? Math.min(width - 64, 1040) / 2 : Math.min(width, 600))
  }
  // Keep the comp's three lines at ordinary sizes; large Dynamic Type reflows naturally.
  const displaySize = compact ? 38 : Math.min(58, (heroWidth - 52) / 6.1)
  // Anton's native ascent/descent is 1.505em; pad the first/last tight line
  // so native Text does not clip the glyphs at the bounds of its drawing area.
  const displayPadding = Math.ceil(displaySize * 0.25)
  const naturalImageWidth = compact ? 154 : Math.min(290, heroWidth * 0.72)
  const topPadding = wide ? Math.max(insets.top, 40) : Math.max(insets.top, 44) + 4
  const bottomPadding = compact ? 12 : 20
  const imageHeight = heroSpace === null || !textHeight
    ? naturalImageWidth * 2 / 3
    : Math.min(naturalImageWidth * 2 / 3, Math.max(0, heroSpace - topPadding - textHeight - bottomPadding - (compact ? 6 : 0)))
  // Keep the composition intact where it fits; give short screens to the task.
  if (heroSpace !== null && textHeight && heroSpace < topPadding + textHeight + bottomPadding + 32) return (
    <View style={{ paddingTop: topPadding, paddingHorizontal: 26, paddingBottom: 12, backgroundColor: colors.leaf }}>
      <AuthWordmark tone="ink" garden color={colors.leafInk} fontFamily={loaded ? 'GardenWordmark' : undefined} />
    </View>
  )
  return (
    <View onLayout={({ nativeEvent }) => setHeroWidth(nativeEvent.layout.width)} style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
      <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { bottom: compact ? 28 : 72 }]}>
        <Svg width="100%" height="100%" viewBox="0 0 390 420" preserveAspectRatio="none">
          <Path d="M0 0H327L390 70V280C366 349 317 389 230 401C174 408 140 432 92 413C45 395 15 366 0 334Z" fill={colors.leaf} />
        </Svg>
      </View>
      <View onLayout={({ nativeEvent }) => setTextHeight(nativeEvent.layout.height)} style={{ paddingHorizontal: 26 }}>
        <AuthWordmark tone="ink" garden color={colors.leafInk} fontFamily={loaded ? 'GardenWordmark' : undefined} />
        {!compact || title ? (
          <NativeText accessibilityRole="header" style={{ marginTop: compact ? 24 : 28, paddingTop: displayPadding, paddingBottom: displayPadding, includeFontPadding: true, color: colors.leafInk, fontFamily: loaded ? 'GardenDisplay' : undefined, fontWeight: loaded ? '400' : '900', fontSize: displaySize, lineHeight: displaySize * 1.04, letterSpacing: -0.8 }}>
            {title ?? (fontScale > 1.2 ? 'Votre foyer. Votre garde-manger.' : 'Votre foyer.\nVotre\ngarde-manger.')}
          </NativeText>
        ) : null}
        {!compact || subtitle ? (
          <NativeText style={{ marginTop: 18, fontSize: 18, lineHeight: 24, color: colors.leafInk }}>
            {subtitle ?? 'Les produits de la maison,\nréunis au même endroit.'}
          </NativeText>
        ) : null}
      </View>
      <Image source={require('../../../assets/illustrations/garden-harvest.png')} accessible={false} style={{ alignSelf: 'flex-end', marginRight: 12, marginTop: compact ? 6 : 0, width: imageHeight * 1.5, height: imageHeight }} resizeMode="contain" />
    </View>
  )
}

/** Native safe areas, natural-height forms, and a full-bleed Garden header. */
export function AuthScreenChrome({ maxWidth, overlay, hero, children }: {
  maxWidth: number
  overlay?: ReactNode
  hero?: ReactNode
  children: ReactNode
}) {
  const palette = useSoftPalette()
  const colors = gardenColors(palette)
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [frameHeight, setFrameHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const wide = width >= 768
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true))
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false))
    return () => { show.remove(); hide.remove() }
  }, [])

  const heroSpace = frameHeight ? Math.max(0, frameHeight - (wide ? 0 : contentHeight) - 12) : null

  return (
    <AuthGardenContext.Provider value={colors}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.ground }}>
        <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={['bottom', 'left', 'right']}>
          <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <AuthEntryLayoutContext.Provider value={{ keyboardOpen, heroSpace, availableHeight: frameHeight }}>
              <View onLayout={({ nativeEvent }) => setFrameHeight(nativeEvent.layout.height)} style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: keyboardOpen ? 'flex-end' : wide ? 'center' : 'flex-start', paddingHorizontal: wide ? 32 : 0, paddingBottom: 12 }}>
                <View style={{ width: '100%', maxWidth: wide ? 1040 : 600, flexDirection: wide && !keyboardOpen ? 'row' : 'column', alignItems: 'stretch' }}>
                  {!keyboardOpen ? <View style={wide ? { flex: 1, alignSelf: 'center' } : undefined}>{hero ?? <AuthGardenHero compact />}</View> : null}
                  <View onLayout={({ nativeEvent }) => setContentHeight(nativeEvent.layout.height)} style={{ ...(wide && !keyboardOpen ? { flex: 1 } : { width: '100%' as const }), maxWidth: maxWidth + 52, alignSelf: 'center', paddingHorizontal: 26, paddingTop: keyboardOpen ? insets.top + 8 : wide ? 40 : 4, paddingBottom: 8, gap: keyboardOpen ? 8 : 16 }}>
                    {children}
                  </View>
                </View>
              </View>
            </AuthEntryLayoutContext.Provider>
          </KeyboardAvoidingView>
        </SafeAreaView>
        {overlay}
      </View>
      </TouchableWithoutFeedback>
    </AuthGardenContext.Provider>
  )
}
