/**
 * What the route gates (`(tabs)`, `(auth)`, `(onboarding)`) render while the
 * session / foyer answer is pending, instead of `null` — which was a blank
 * screen for as long as a slow or unreachable server took to answer.
 *
 * It sits on the app's own ground (the auth blobs): the condensed brand and the familiar fridge mascot anchor the wait, so a wait
 * reads as the brand arriving rather than as an empty screen. The retry block
 * lives at the bottom edge; compact recovery gives the actions priority.
 *
 * Past `STALLED_MS` the dots stop being an honest answer: say the server is
 * not answering and offer the two ways out (retry, or pick another server —
 * the usual cause is a stale URL).
 */
import { useEffect, useState } from 'react'
import { Image, Platform, Text as NativeText, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useFonts } from 'expo-font'
import Reanimated, { FadeOut } from 'react-native-reanimated'
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold'
import { Text, YStack } from './tamagui-typed.js'
import { PantryLoader } from './pantry-loader.js'
import { PillButton } from './pill-button.js'
import { useReduceMotion } from './hover.js'
import { useSharedAuthBackground, useSplashBackground } from '../identity/auth-background-frame.js'
import { AuthBlobBackground } from '../identity/auth-blob-background.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { queryClient } from '../../application/shared/query-client.js'

const mascot = require('../../../assets/mascot.png')

const STALLED_MS = 6000

/** Only foreground content fades out; the shared ground stays mounted. Skipped under Reduce Motion. */
const GROUND_OUT = FadeOut.duration(300)
export function BootSplash() {
  const sharedBackground = useSharedAuthBackground()
  useSplashBackground()
  const { width, height, fontScale } = useWindowDimensions()
  const compact = height / fontScale < 700
  const displaySize = Math.min(compact ? 40 : 52, (width - 52) / 5.7)
  const displayPadding = Math.ceil(displaySize * 0.12)
  const imageWidth = Math.min(compact ? 190 : 240, width - 52)
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  // Web uses the shared variable face, with its actual 800 weight.
  const [fontLoaded] = useFonts(Platform.OS === 'web' ? {} : { PlusJakartaSans_800ExtraBold })
  const brandFont = Platform.OS === 'web' ? '"Plus Jakarta Sans", system-ui, sans-serif' : fontLoaded ? 'PlusJakartaSans_800ExtraBold' : undefined
  const [stalled, setStalled] = useState(false)
  const [retrying, setRetrying] = useState(false)
  // A successful retry unmounts the splash (the gate lets the app through), so
  // still being here once it settles means the server did not answer.
  const [retried, setRetried] = useState(false)

  function retry() {
    if (retrying) return
    setRetrying(true)
    void queryClient.invalidateQueries().finally(() => {
      setRetrying(false)
      setRetried(true)
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => setStalled(true), STALLED_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Reanimated.View style={{ flex: 1 }} exiting={reduceMotion ? undefined : GROUND_OUT}>
    <YStack testID="boot-splash" flex={1} overflow="hidden" backgroundColor={sharedBackground ? 'transparent' : palette.cream}>
      {!sharedBackground ? <AuthBlobBackground ground={palette.cream} /> : null}
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
      <YStack flex={1} minHeight={0} alignItems="center" justifyContent="center" paddingHorizontal={26} paddingVertical={16}>
        <YStack width="100%" maxWidth={440} alignItems="center">
          {stalled && compact ? (
            <Text fontFamily={brandFont} fontSize={22} fontWeight="800" color={palette.ink}>Garde-manger</Text>
          ) : (
            <>
              {height / fontScale >= 500 ? <Image source={mascot} accessible={false} resizeMode="contain" style={{ width: imageWidth, height: imageWidth, marginBottom: 12 }} /> : null}
              <NativeText accessibilityRole="header" style={{ alignSelf: 'stretch', textAlign: 'center', fontFamily: brandFont, fontWeight: Platform.OS === 'web' ? '800' : fontLoaded ? '400' : '900', fontSize: displaySize, lineHeight: displaySize * 1.15, letterSpacing: -0.8, paddingVertical: displayPadding, includeFontPadding: true, color: palette.ink }}>
                {'GARDE-\nMANGER'}
              </NativeText>
            </>
          )}
          {!stalled || retrying ? (
            <YStack alignItems="center" gap={16} marginTop={24} accessibilityLiveRegion="polite">
              <Text fontSize={14} lineHeight={20} color={palette.inkSecondary} textAlign="center">Ouverture du garde-manger…</Text>
              <PantryLoader palette={palette} label="Ouverture du garde-manger" testID="boot-splash-loader" />
            </YStack>
          ) : null}
        </YStack>
      </YStack>
      {stalled ? (
        <YStack
          testID="boot-splash-stalled"
          alignItems="center"
          gap="$3"
          paddingHorizontal={26}
          paddingBottom={16}
          accessibilityLiveRegion="polite"
        >
          <Text fontFamily={brandFont} fontSize={18} fontWeight="800" color={palette.ink}>
            {retried && !retrying ? 'Toujours injoignable' : 'Serveur injoignable'}
          </Text>
          <Text fontSize={13} fontWeight="500" textAlign="center" color={palette.inkSecondary}>
            Vérifie ta connexion, ou l’adresse du serveur si elle a changé.
          </Text>
          <PillButton centered label={retrying ? 'Nouvelle tentative…' : 'Réessayer'} palette={palette} onPress={retry} />
          <PillButton
            centered
            tone="quiet"
            label="Changer de serveur"
            palette={palette}
            onPress={() => router.push('/server-choice?next=sign-in')}
          />
        </YStack>
      ) : null}
      </SafeAreaView>
    </YStack>
    </Reanimated.View>
  )
}
