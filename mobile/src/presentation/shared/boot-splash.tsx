/**
 * What the route gates (`(tabs)`, `(auth)`, `(onboarding)`) render while the
 * session / foyer answer is pending, instead of `null` — which was a blank
 * screen for as long as a slow or unreachable server took to answer.
 *
 * It sits on the app's own ground (the auth blobs): the mascot and wordmark at full size are the only content, so a wait
 * reads as the brand arriving rather than as an empty screen. The retry block
 * lives at the bottom edge, so the lockup never jumps when it appears.
 *
 * Past `STALLED_MS` the dots stop being an honest answer: say the server is
 * not answering and offer the two ways out (retry, or pick another server —
 * the usual cause is a stale URL).
 */
import { useEffect, useState } from 'react'
import { Animated, Easing, Image } from 'react-native'
import { router } from 'expo-router'
import { useFonts } from 'expo-font'
import Reanimated, { FadeOut } from 'react-native-reanimated'
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold'
import { Text, YStack } from './tamagui-typed.js'
import { PulseDots } from './pulse-dots.js'
import { PillButton } from './pill-button.js'
import { useReduceMotion } from './hover.js'
import { AuthBlobBackground } from '../identity/auth-blob-background.js'
import { ChefHatIcon, LeafIcon, PackageIcon, ReceiptIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette, type SoftPalette } from '../dashboard/soft-palette.js'
import { queryClient } from '../../application/shared/query-client.js'

const mascotIllustration = require('../../../assets/mascot.png')

const STALLED_MS = 6000

/** The way out: the ground fades when a gate stops rendering the splash. Skipped under Reduce Motion. */
const GROUND_OUT = FadeOut.duration(300)
/** One slow breath of the mascot: the screen's single authored motion. */
const FLOAT_MS = 1800
const FLOAT_RISE = 10

/**
 * What the app handles, drifting around the mascot: the same pastel icon chips
 * the Réglages cards carry, tilted and counter-floating so the ground is not
 * empty. `dir` flips the float so the chips never all rise together.
 */
const CHIPS = [
  { Icon: ChefHatIcon, tint: (p: SoftPalette) => p.chipViolet, size: 60, rotate: '-12deg', dir: 1, pos: { top: 6, left: 4 } },
  { Icon: LeafIcon, tint: (p: SoftPalette) => p.chipTeal, size: 48, rotate: '10deg', dir: -1, pos: { top: 0, right: 10 } },
  { Icon: ReceiptIcon, tint: (p: SoftPalette) => p.chipOrange, size: 54, rotate: '8deg', dir: -1, pos: { top: 178, left: -6 } },
  { Icon: PackageIcon, tint: (p: SoftPalette) => p.chipButter, size: 64, rotate: '-8deg', dir: 1, pos: { bottom: 4, right: 0 } },
] as const

export function BootSplash() {
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  // DESIGN.md's target family; the rest of the app is still on the system stack, so it is loaded here for the wordmark and title only.
  const [fontLoaded] = useFonts({ PlusJakartaSans_800ExtraBold })
  const brandFont = fontLoaded ? 'PlusJakartaSans_800ExtraBold' : undefined
  const [stalled, setStalled] = useState(false)
  const [retrying, setRetrying] = useState(false)
  // A successful retry unmounts the splash (the gate lets the app through), so
  // still being here once it settles means the server did not answer.
  const [retried, setRetried] = useState(false)
  const [float] = useState(() => new Animated.Value(0))

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

  useEffect(() => {
    if (reduceMotion) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: FLOAT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: FLOAT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [float, reduceMotion])

  return (
    <Reanimated.View style={{ flex: 1 }} exiting={reduceMotion ? undefined : GROUND_OUT}>
    <YStack testID="boot-splash" flex={1} overflow="hidden" backgroundColor={palette.gradientBottom}>
      <AuthBlobBackground />
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$5">
        <YStack width={320} height={300} alignItems="center" justifyContent="center">
          {CHIPS.map(({ Icon, tint, size, rotate, dir, pos }) => (
            <Animated.View
              key={rotate}
              style={{
                position: 'absolute',
                ...pos,
                width: size,
                height: size,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tint(palette),
                borderTopLeftRadius: size * 0.5,
                borderTopRightRadius: size * 0.3,
                borderBottomRightRadius: size * 0.5,
                borderBottomLeftRadius: size * 0.3,
                transform: [
                  { rotate },
                  { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, dir * FLOAT_RISE] }) },
                ],
              }}
            >
              <Icon size={size * 0.46} color={palette.onDark} />
            </Animated.View>
          ))}
          <Animated.View
            style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT_RISE] }) }] }}
          >
            <Image source={mascotIllustration} style={{ width: 220, height: 220 }} resizeMode="contain" accessibilityLabel="" />
          </Animated.View>
        </YStack>
        <Text fontFamily={brandFont} fontSize={34} fontWeight="800" letterSpacing={3} color={palette.ink} role="heading">
          GARDE-MANGER
        </Text>
        {/* Loading is over once the wait is declared stalled: only a retry in flight brings the dots back. */}
        {!stalled || retrying ? <PulseDots palette={palette} size={12} /> : null}
      </YStack>
      {stalled ? (
        <YStack
          testID="boot-splash-stalled"
          alignItems="center"
          gap="$3"
          paddingHorizontal="$5"
          paddingBottom="$8"
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
    </YStack>
    </Reanimated.View>
  )
}
