import type { ReactNode } from 'react'
import { Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { hexToRgba } from '../shared/hex-to-rgba.js'
import { ChevronRightIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * The full-width identity card used at the top of Réglages for the account
 * and the foyer.
 *
 * Réglages used to open on a `StatCard` pair — two flex-1 pastel cards side
 * by side, the same component the dashboard uses for a two-digit metric.
 * A metric fits in half a phone width; a household name does not. "Le foyer
 * de Florian" rendered as "Le foyer de F…" on every phone, and the one line
 * that had to carry the foyer's identity was the one line that got cut. The
 * card that names a thing gets the whole width; the cards that count things
 * keep sharing one.
 *
 * Same pastel language as `StatCard` (fill, 36pt saturated icon chip,
 * card-float shadow, its own asymmetric corner set), turned on its side: the
 * chip moves beside the text instead of above it, which is what buys the
 * name its full measure. `trailing` takes the foyer's role badge, `footer`
 * the member avatars — both absent on the account card, which is a plain
 * container rather than a pressable.
 */
export function IdentityCard({
  testID,
  bg,
  labelColor,
  chipColor,
  icon,
  label,
  value,
  valueBadge,
  secondary,
  trailing,
  footer,
  corner,
  palette,
  onPress,
  accessibilityLabel,
}: {
  testID?: string
  bg: string
  labelColor: string
  chipColor: string
  icon: ReactNode
  label: string
  value: string
  /** Inline right after the value — e.g. the official instance's certified badge. */
  valueBadge?: ReactNode
  secondary?: string
  /** Right-aligned badge on the label row — the foyer's role. */
  trailing?: ReactNode
  /** A row under the value — the foyer's member avatars. */
  footer?: ReactNode
  corner: 'a' | 'b'
  palette: SoftPalette
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const hover = useHoverPress()
  // Wider than StatCard's sets, because these cards are wider — a 26pt
  // corner that reads generous on a half-width tile reads timid across the
  // full column. Two sets, mirrored, so the stacked pair never repeats one.
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 30, borderTopRightRadius: 16, borderBottomRightRadius: 30, borderBottomLeftRadius: 16 }
      : { borderTopLeftRadius: 16, borderTopRightRadius: 30, borderBottomRightRadius: 16, borderBottomLeftRadius: 30 }

  const card = (
    <YStack
      testID={onPress ? undefined : testID}
      backgroundColor={bg}
      padding="$4"
      gap="$3"
      overflow="hidden"
      style={{ ...radii, shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 }}
    >
      {/* A flat pastel fill under flat pastel fills is where "terne" came
          from — the same top-light sheen `welcome-screen.tsx`'s vignette and
          `fridge-cabinet.tsx`'s interior light already use elsewhere in the
          app, here reading as sun on the pantry shelf rather than a printed
          tile. Absolute + `pointerEvents="none"`: decoration, never a hit
          target. A white highlight on dark mode's dim card fills read as a
          flat gray smear rather than a sheen — dark mode darkens instead,
          same "light source above" read either way. */}
      <LinearGradient
        colors={
          palette.blurTint === 'dark'
            ? [hexToRgba('#000000', 0.22), hexToRgba('#000000', 0)]
            : [hexToRgba('#ffffff', 0.22), hexToRgba('#ffffff', 0)]
        }
        locations={[0, 0.6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '65%' }}
      />
      <XStack alignItems="center" gap="$3">
        <YStack
          width={36}
          height={36}
          borderRadius={12}
          backgroundColor={chipColor}
          alignItems="center"
          justifyContent="center"
          style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 4 }}
        >
          {icon}
        </YStack>
        <YStack flex={1} minWidth={0}>
          <Text fontSize={12} fontWeight="500" color={labelColor}>
            {label}
          </Text>
          {/* Two lines, not one: this card exists because "Le foyer de Florian"
              was cut to "Le foyer de F…". Buying the width and keeping the
              one-line clamp would have kept the scissors. */}
          <XStack alignItems="center" gap="$1.5" marginTop="$0.5">
            <Text flexShrink={1} fontSize={20} fontWeight="800" color={palette.ink} numberOfLines={2}>
              {value}
            </Text>
            {valueBadge}
          </XStack>
          {secondary ? (
            <Text fontSize={12} fontWeight="500" color={labelColor} marginTop="$0.5" numberOfLines={1}>
              {secondary}
            </Text>
          ) : null}
        </YStack>
        {trailing}
        {onPress ? <ChevronRightIcon size={18} color={labelColor} /> : null}
      </XStack>
      {footer}
    </YStack>
  )

  if (!onPress) return card

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? value}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>{card}</Animated.View>
    </Pressable>
  )
}

/** The role badge on the foyer card — a pill, per the system's "pill means status/action/badge" rule. */
export function RoleBadge({ label, palette }: { label: string; palette: SoftPalette }) {
  return (
    <XStack backgroundColor={palette.gradientBottom} paddingVertical="$1" paddingHorizontal="$2.5" borderRadius={999}>
      <Text fontSize={11} fontWeight="700" color={palette.mintPaleText}>
        {label}
      </Text>
    </XStack>
  )
}
