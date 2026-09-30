import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { AuthWordmark } from './auth-wordmark.js'

/** Garden's organic composition, using the app's existing mint and illustration. */
export function AuthGardenHero() {
  const palette = useSoftPalette()
  return (
    <View style={{ position: 'relative', padding: 28, paddingBottom: 20, minHeight: 248 }}>
      <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="none">
          <Path d="M0 0H400V194C399 277 319 305 207 291C117 278 84 309 35 274C-2 248 0 190 0 150Z" fill={palette.blobSoft} />
        </Svg>
      </View>
      <Text accessibilityRole="header" fontSize={36} fontWeight="800" letterSpacing={-1} color={palette.ink}>
        Ton foyer.{'\n'}Ton garde-manger.
      </Text>
      <YStack marginTop={12} paddingRight={78} minHeight={86} justifyContent="center">
        <Text fontSize={15} color={palette.ink}>Ce qu’il reste, quoi cuisiner, quoi racheter. Ensemble.</Text>
      </YStack>
      <Image source={require('../../../assets/illustrations/carrot-3d.png')} accessible={false} style={{ position: 'absolute', right: 8, bottom: 8, width: 104, height: 104 }} resizeMode="contain" />
    </View>
  )
}

/** One safe-area and keyboard-aware frame for the complete entry flow. */
export function AuthScreenChrome({ maxWidth, overlay, hero, children }: {
  maxWidth: number
  overlay?: ReactNode
  hero?: ReactNode
  children: ReactNode
}) {
  const palette = useSoftPalette()
  const { width } = useWindowDimensions()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const wide = width >= 768
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false))
    return () => { show.remove(); hide.remove() }
  }, [])

  return (
    <YStack flex={1} minHeight={0} backgroundColor={wide ? palette.layoutSurface : palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: wide ? 'center' : 'flex-start', padding: wide ? 32 : 20 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={{ width: '100%', maxWidth: hero && wide ? 1040 : maxWidth, padding: wide ? 32 : 0, borderRadius: 28, backgroundColor: palette.gradientBottom, gap: 24 }}>
              <AuthWordmark tone="ink" />
              <View style={{ flexDirection: wide && hero && !keyboardOpen ? 'row' : 'column', alignItems: 'stretch', gap: wide ? 32 : 28 }}>
                {hero && !keyboardOpen ? <View style={wide ? { flex: 1, justifyContent: 'center' } : undefined}>{hero}</View> : null}
                <View style={{ ...(wide && hero && !keyboardOpen ? { flex: 1 } : { width: '100%' as const }), maxWidth, alignSelf: 'center', gap: 24 }}>
                  {children}
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {overlay}
    </YStack>
  )
}
