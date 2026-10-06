import { useTranslation } from '../../i18n/index.js'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Image, Keyboard, KeyboardAvoidingView, Platform, Text as NativeText, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular'
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useSharedAuthBackground } from './auth-background-frame.js'
import { AuthWordmark } from './auth-wordmark.js'
import { AuthEntryLayoutContext, AuthGardenContext, gardenColors, useAuthEntryLayout } from './auth-garden-theme.js'

/** The approved comp's edge-to-edge field, oversized lettering and the familiar fridge mascot. */
export function AuthGardenHero({ compact = false, title, subtitle }: { compact?: boolean; title?: string; subtitle?: string }) {
  const { t } = useTranslation()
  const colors = gardenColors(useSoftPalette())
  const { heroSpace } = useAuthEntryLayout()
  const [textHeight, setTextHeight] = useState(0)
  const { width, height, fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const wide = width >= 768 && width > height
  const [heroWidth, setHeroWidth] = useState(wide ? Math.min(width - 64, 1040) / 2 : Math.min(width, 600))
  const [measurementKey, setMeasurementKey] = useState('')
  const [loaded] = useFonts(Platform.OS === 'web' ? {} : {
    GardenTagline: PlusJakartaSans_400Regular,
    GardenWordmark: PlusJakartaSans_800ExtraBold,
  })
  const wordmarkFont = Platform.OS === 'web' ? undefined : loaded ? 'GardenWordmark' : undefined
  const titleFont = Platform.OS === 'web' ? 'Spectral, Georgia, serif' : wordmarkFont
  const titleWeight = Platform.OS === 'web' ? '600' : loaded ? '400' : '900'
  const nextMeasurementKey = [width, fontScale, compact, title, subtitle, loaded].join('|')
  if (measurementKey !== nextMeasurementKey) {
    setMeasurementKey(nextMeasurementKey)
    setTextHeight(0)
    setHeroWidth(wide ? Math.min(width - 64, 1040) / 2 : Math.min(width, 600))
  }
  // Keep the comp's three lines at ordinary sizes; large Dynamic Type reflows naturally.
  const displaySize = compact ? 32 : Math.min(48, (heroWidth - 52) / 8)
  // Keep Jakarta's wider letterforms within the existing three-line composition.
  const displayPadding = Math.ceil(displaySize * 0.12)
  const naturalImageWidth = compact ? 112 : Math.min(200, heroWidth * 0.52)
  const topPadding = wide ? Math.max(insets.top, 40) : Math.max(insets.top, 44) + 4
  const bottomPadding = compact ? 12 : 20
  const imageHeight = heroSpace === null || !textHeight
    ? naturalImageWidth
    : Math.min(naturalImageWidth, Math.max(0, heroSpace - topPadding - textHeight - bottomPadding - (compact ? 6 : 0)))
  // Keep the composition intact where it fits; give short screens to the task.
  if (heroSpace !== null && textHeight && heroSpace < topPadding + textHeight + bottomPadding + 32) return (
    <View style={{ paddingTop: topPadding, paddingHorizontal: 26, paddingBottom: 12 }}>
      <AuthWordmark tone="ink" garden color={colors.leafInk} fontFamily={wordmarkFont} />
    </View>
  )
  return (
    <View onLayout={({ nativeEvent }) => setHeroWidth(nativeEvent.layout.width)} style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
      <View onLayout={({ nativeEvent }) => setTextHeight(nativeEvent.layout.height)} style={{ paddingHorizontal: 26 }}>
        <AuthWordmark tone="ink" garden color={colors.leafInk} fontFamily={wordmarkFont} />
        {!compact || title ? (
          <NativeText accessibilityRole="header" style={{ marginTop: compact ? 24 : 28, paddingTop: displayPadding, paddingBottom: displayPadding, includeFontPadding: true, color: colors.leafInk, fontFamily: titleFont, fontWeight: titleWeight, fontSize: displaySize, lineHeight: displaySize * 1.15, letterSpacing: -0.8 }}>
            {title ?? (fontScale > 1.2 ? t('identity.your_household_your_pantry') : t('identity.your_household_your_pantry_2'))}
          </NativeText>
        ) : null}
        {!compact || subtitle ? (
          <NativeText style={{ marginTop: 18, fontFamily: Platform.OS === 'web' ? '"Plus Jakarta Sans", system-ui, sans-serif' : loaded ? 'GardenTagline' : undefined, fontWeight: '400', fontSize: 18, lineHeight: 24, color: colors.leafInk }}>
            {subtitle ?? t('identity.all_your_household_s_products_together_in_one_place')}
          </NativeText>
        ) : null}
      </View>
      <Image source={require('../../../assets/mascot.png')} accessible={false} style={{ alignSelf: 'flex-end', marginRight: 12, marginTop: compact ? 6 : 0, width: imageHeight, height: imageHeight }} resizeMode="contain" />
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
  const sharedBackground = useSharedAuthBackground()
  const palette = useSoftPalette()
  const colors = gardenColors(palette)
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [frameHeight, setFrameHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const wide = width >= 768 && width > height
  // A compact form header has no hero content to justify a second column.
  const split = wide && Boolean(hero)
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true))
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false))
    return () => { show.remove(); hide.remove() }
  }, [])

  const heroSpace = frameHeight ? Math.max(0, frameHeight - (split ? 0 : contentHeight) - 12) : null

  const content = (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: sharedBackground ? 'transparent' : colors.ground }}>
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={['bottom', 'left', 'right']}>
        <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <AuthEntryLayoutContext.Provider value={{ keyboardOpen, heroSpace, availableHeight: frameHeight }}>
            <View onLayout={({ nativeEvent }) => setFrameHeight(nativeEvent.layout.height)} style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: keyboardOpen ? 'flex-end' : wide ? 'center' : 'flex-start', paddingHorizontal: wide ? 32 : 0, paddingBottom: 12 }}>
              <View style={{ width: '100%', maxWidth: split ? 1040 : 600, flexDirection: split && !keyboardOpen ? 'row' : 'column', alignItems: 'stretch' }}>
                {!keyboardOpen ? <View style={split ? { width: '50%', minWidth: 0, flexShrink: 1, alignSelf: 'center' } : undefined}>{hero ?? <AuthGardenHero compact />}</View> : null}
                <View onLayout={({ nativeEvent }) => setContentHeight(nativeEvent.layout.height)} style={{ ...(split && !keyboardOpen ? { width: '50%' as const, minWidth: 0, flexShrink: 1 } : { width: '100%' as const }), maxWidth: maxWidth + 52, alignSelf: 'center', paddingHorizontal: 26, paddingTop: keyboardOpen ? insets.top + 8 : split ? 40 : 4, paddingBottom: 8, gap: keyboardOpen ? 8 : 16 }}>
                  {children}
                </View>
              </View>
            </View>
          </AuthEntryLayoutContext.Provider>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {overlay}
    </View>
  )

  return (
    <AuthGardenContext.Provider value={colors}>
      {/* On web, descendant input clicks bubble here and dismiss blurs the input. */}
      {Platform.OS === 'web' ? content : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {content}
        </TouchableWithoutFeedback>
      )}
    </AuthGardenContext.Provider>
  )
}
