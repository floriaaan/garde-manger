/**
 * The one selectable chip in the app — locations, units, category
 * suggestions, expiry shortcuts, compartment filters, AI providers.
 *
 * It existed three times before this file (fridge form's `Chip`, fridge
 * list's `FilterChip`, settings' `ProviderChip`), each a near-copy with a
 * different padding, and all three sized the same way: `minHeight: 44` with
 * `paddingHorizontal: $3.5`. That reads as a stack of buttons rather than a
 * row of options — the feedback that started this file was that chips inside
 * a form are far too big. 44 was never a look, it was the touch-target floor.
 *
 * So the floor moves off the box and onto the press area: the chip draws at
 * 32pt tall (28 in `dense`) and carries a `hitSlop` that pads the tappable
 * region back past 44. Same finger, smaller ink.
 *
 * That makes the gap between chips load-bearing, and it is the one thing a
 * caller has to get right: **a row of chips needs `gap="$3"` (12pt), and a
 * horizontal strip needs at least 8.** Two chips closer than the sum of their
 * facing slops have overlapping press areas, and a tap in the overlap lands on
 * whichever happens to be on top. The horizontal slop is deliberately the
 * smaller of the two (4 vs 6) because horizontal is never the axis that misses
 * the floor — 12pt of padding either side of a label already clears 44 wide.
 *
 * An `icon` renders before the label at 13px and inherits the label's colour,
 * so a chip can be recognised before it is read (the location chips, chiefly).
 *
 * `accessibilityLabel` overrides what a screen reader announces without
 * touching what is drawn. A row of chips is unambiguous on screen because the
 * group's own label sits above it; read aloud, "15 min" arrives with no idea
 * it belongs to "Temps en cuisine", so a caller that stacks several groups
 * (the recipe composer) prefixes each chip with its group.
 */
import type { ReactNode } from 'react'
import { Animated } from 'react-native'
import { Pressable } from './pressable.js'
import { Text, XStack } from './tamagui-typed.js'
import { pointerCursor, pressAreaSlop, useHoverPress } from './hover.js'
import { ripple, rippleClip } from './material.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/** Height of the drawn pill. The tappable area is padded back to ≥44 by `hitSlop`. */
const CHIP_HEIGHT = { default: 32, dense: 28 } as const

export const CHIP_ICON_SIZE = 13

export function Chip({
  testID,
  label,
  selected,
  onPress,
  palette,
  icon,
  size = 'default',
  accessibilityLabel,
}: {
  testID?: string
  label: string
  selected: boolean
  onPress: () => void
  palette: SoftPalette
  /** Announced instead of `label`; the drawn text is unchanged. */
  accessibilityLabel?: string
  /** Called with the label colour so the glyph always matches the text it sits beside. */
  icon?: (color: string) => ReactNode
  size?: keyof typeof CHIP_HEIGHT
}) {
  const hover = useHoverPress()
  const height = CHIP_HEIGHT[size]
  const slop = Math.ceil((44 - height) / 2)
  const color = selected ? palette.accentLimeText : palette.mintPaleText

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      hitSlop={{ top: slop, bottom: slop, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      android_ripple={ripple(selected ? palette.accentLimeText : palette.mintPaleText)}
      // `hitSlop` on native, the same slop as margin/padding on web, which
      // ignores the prop — without it the chip is its drawn 32pt in a browser.
      style={[pointerCursor, pressAreaSlop(slop, 4), rippleClip(999)]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="center"
          gap="$1.5"
          minHeight={height}
          paddingHorizontal={size === 'dense' ? 10 : 12}
          borderRadius={999}
          backgroundColor={selected ? palette.accentLime : palette.mintPale}
        >
          {icon ? icon(color) : null}
          <Text fontSize={12} fontWeight="700" color={color}>
            {label}
          </Text>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
