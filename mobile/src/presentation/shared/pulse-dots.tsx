/**
 * The app's own "working on it", for a wait that has no measurable progress.
 *
 * `ActivityIndicator` was standing in for this — the platform's grey wheel on
 * the one screen whose whole job is a several-second wait. It is the only
 * element in the app drawn by the OS rather than by this design system, and it
 * says nothing the system says: no chip colours, no rhythm, no personality.
 *
 * Three dots in the three chip colours the app already uses for its categories
 * (orange / violet / teal), rising and dimming in sequence — the "ingredients
 * being gathered" reading is deliberate on a screen that is writing a recipe.
 * The stagger is what makes it read as one movement travelling across the row
 * rather than three things blinking.
 *
 * Under Reduce Motion the dots hold still, fully lit: the row is still
 * visibly a loader, it just stops travelling. Same rule as `Skeleton`'s
 * shimmer.
 *
 * Not `Skeleton`: a skeleton preserves the *shape* of content that is coming,
 * which is the right answer when you know what will land and where. Here
 * nothing lands on this screen at all — the sheet closes onto a recipe — so
 * there is no shape to hold, only time to fill.
 */
import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { XStack } from './tamagui-typed.js'
import { useReduceMotion } from './hover.js'
import { IS_ANDROID, MATERIAL_MOTION } from './material.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/** One full rise-and-fall, per dot. */
const CYCLE_MS = 520
/** How far behind the dot to its left each dot runs. Below ~120 the row reads as one blink. */
const STAGGER_MS = 150
const RISE = 6

function Dot({ color, delay, size, reduceMotion }: { color: string; delay: number; size: number; reduceMotion: boolean }) {
  const [beat] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (reduceMotion) {
      beat.setValue(0)
      return
    }
    const duration = IS_ANDROID ? MATERIAL_MOTION.short + 120 : CYCLE_MS
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(beat, { toValue: 1, duration, easing: MATERIAL_MOTION.standard, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        // The tail keeps every dot on the same period whatever its head delay,
        // so the three never drift into unison after a few cycles.
        Animated.delay(STAGGER_MS * 2 - delay),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [beat, delay, reduceMotion])

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        // Never fully out: a dot that reaches 0 reads as a gap in the row.
        opacity: reduceMotion ? 1 : beat.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [
          { translateY: reduceMotion ? 0 : beat.interpolate({ inputRange: [0, 1], outputRange: [0, -RISE] }) },
        ],
      }}
    />
  )
}

export function PulseDots({
  palette,
  size = 10,
  testID,
  label = 'Chargement',
}: {
  palette: SoftPalette
  size?: number
  testID?: string
  /** Announced once for the whole row — three anonymous dots are noise to a screen reader. */
  label?: string
}) {
  const reduceMotion = useReduceMotion()
  const colors = [palette.chipOrange, palette.chipViolet, palette.chipTeal]

  return (
    <XStack
      testID={testID}
      alignItems="center"
      gap="$2"
      // `RISE` of headroom top and bottom so the travel never clips against a
      // parent that sized itself to the dots at rest.
      paddingVertical={RISE}
      accessible
      role="progressbar"
      accessibilityLabel={label}
    >
      {colors.map((color, index) => (
        <Dot key={color} color={color} delay={index * STAGGER_MS} size={size} reduceMotion={reduceMotion} />
      ))}
    </XStack>
  )
}
