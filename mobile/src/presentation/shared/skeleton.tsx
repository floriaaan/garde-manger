/**
 * Loading states that keep the page's shape.
 *
 * Every screen used to answer a pending query with the word "Chargement…" on
 * one line, which throws away the two things a loading state is for: telling
 * the reader that content is coming, and telling them *what shape* it will
 * be, so the layout does not jump under their thumb when it lands. A fridge
 * with eleven products and a fridge that is still fetching should occupy the
 * same space.
 *
 * The shimmer is one authored moment, not decoration: a slow opacity sweep on
 * the `cream` fill, which is already this system's "quiet surface" colour, so
 * a skeleton reads as furniture rather than as a grey web placeholder. Under
 * Reduce Motion it holds still at its mid value — the block is still visibly
 * a placeholder, it just stops breathing.
 */
import { useEffect, useState } from 'react'
import { Animated } from 'react-native'
import { YStack, XStack } from './tamagui-typed.js'
import { useReduceMotion } from './hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { IS_ANDROID, MATERIAL_MOTION } from './material.js'

/** One shimmering block. `width` accepts a number or a percentage string. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  palette,
}: {
  width?: number | string
  height?: number
  radius?: number
  palette?: SoftPalette
}) {
  const fallback = useSoftPalette()
  const tone = palette ?? fallback
  const reduceMotion = useReduceMotion()
  const [pulse] = useState(() => new Animated.Value(0.6))

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.75)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: IS_ANDROID ? MATERIAL_MOTION.long : 620,
          easing: MATERIAL_MOTION.standard,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: IS_ANDROID ? MATERIAL_MOTION.long : 620,
          easing: MATERIAL_MOTION.standard,
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, reduceMotion])

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: width as number,
        height,
        borderRadius: radius,
        backgroundColor: tone.cream,
        opacity: pulse,
      }}
    />
  )
}

/**
 * The whole loading state, announced once. A screen reader should hear
 * "Chargement" a single time, not twenty-four anonymous blocks — so the
 * blocks themselves are hidden from the accessibility tree (above) and this
 * wrapper carries the only label.
 */
export function SkeletonGroup({ label = 'Chargement', children }: { label?: string; children: React.ReactNode }) {
  return (
    <YStack gap="$3" accessible accessibilityLabel={label} role="progressbar">
      {children}
    </YStack>
  )
}

/** A placeholder shaped like one list row: icon chip, two text lines, trailing value. */
export function SkeletonRow({ palette, chip = 36 }: { palette?: SoftPalette; chip?: number }) {
  const fallback = useSoftPalette()
  const tone = palette ?? fallback
  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$2">
      <Skeleton width={chip} height={chip} radius={12} palette={tone} />
      <YStack flex={1} gap="$2">
        <Skeleton width="62%" height={13} palette={tone} />
        <Skeleton width="38%" height={11} palette={tone} />
      </YStack>
      <Skeleton width={52} height={11} palette={tone} />
    </XStack>
  )
}

/** A placeholder shaped like one of the pastel cards. */
export function SkeletonCard({ height = 96, palette }: { height?: number; palette?: SoftPalette }) {
  const fallback = useSoftPalette()
  return <Skeleton width="100%" height={height} radius={22} palette={palette ?? fallback} />
}

/** `n` rows inside one announcement — the default shape for a list that is still fetching. */
export function SkeletonList({ rows = 4, palette, label }: { rows?: number; palette?: SoftPalette; label?: string }) {
  return (
    <SkeletonGroup label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonRow key={index} palette={palette} />
      ))}
    </SkeletonGroup>
  )
}
