/**
 * The one lime action pill.
 *
 * There were five independent implementations of it — `AddProductButton` and
 * the empty/error pills in the garde-manger, `EmptyAction` and the hero's
 * retry on the dashboard, the shopping list's and the receipt history's empty
 * actions — each with its own padding, its own hover wiring (or none), and its
 * own idea of whether it stretched. The chips were consolidated into one
 * component; the pills never were, so the app's second-most-repeated control
 * drifted in five directions.
 *
 * `alignSelf: 'flex-start'` is the load-bearing default: a Pressable in a
 * YStack stretches, and a pill that stretches stops being a pill.
 * `centered` swaps that for `alignSelf: 'center'` — for the one other shape
 * this pill takes, the sole CTA under a centered empty-state icon+heading,
 * where flex-start pins it to the left edge instead of under the text it
 * answers.
 *
 * `AuthButton` stays separate on purpose — it is the 50pt full-width form
 * submit of the auth screens, a different control with a different job.
 */
import type { ReactNode } from 'react'
import { Animated, Platform } from 'react-native'
import { Pressable } from './pressable.js'
import { Text, XStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/** Drawn height/type per `size` — `dense` is `Chip`'s own compact recipe
 * (32pt, 12px label), for a row of 3+ pills that needs to hold one line
 * (the invite card's Partager/Copier/QR trio, 2026-09-09 ask) without
 * shrinking the touch target below 44pt (48dp on Android) — `hitSlop` pads it back. */
const MIN_TARGET_HEIGHT = Platform.OS === 'android' ? 48 : 44
const PILL_HEIGHT = { default: MIN_TARGET_HEIGHT, dense: 32 } as const

export function PillButton({
  testID,
  label,
  onPress,
  palette,
  icon,
  accessibilityLabel,
  tone = 'accent',
  size = 'default',
  centered = false,
  disabled = false,
}: {
  testID?: string
  label: string
  onPress: () => void
  palette: SoftPalette
  /** `accent` is the lime primary; `quiet` is the cream secondary that sits beside it (the empty fridge's two ways in). */
  tone?: 'accent' | 'quiet'
  /** Called with the label colour so the glyph always matches the text beside it. */
  icon?: (color: string) => ReactNode
  /** Announced instead of `label` when the label alone is not a sentence ("Réessayer"). */
  accessibilityLabel?: string
  size?: keyof typeof PILL_HEIGHT
  /** For a centered empty state's own CTA — see the note above `flex-start`. */
  centered?: boolean
  disabled?: boolean
}) {
  const hover = useHoverPress()
  const height = PILL_HEIGHT[size]
  const slop = Math.max(0, Math.ceil((MIN_TARGET_HEIGHT - height) / 2))
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      hitSlop={{ top: slop, bottom: slop, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[pointerCursor, { alignSelf: centered ? 'center' : 'flex-start' }]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], opacity: disabled ? 0.6 : 1 }}>
        <XStack
          alignItems="center"
          gap="$1.5"
          minHeight={height}
          paddingHorizontal={size === 'dense' ? '$3' : '$4'}
          borderRadius={999}
          justifyContent="center"
          backgroundColor={tone === 'accent' ? palette.accentLime : palette.cream}
        >
          {icon ? icon(tone === 'accent' ? palette.accentLimeText : palette.ink) : null}
          <Text
            fontSize={size === 'dense' ? 12 : 14}
            fontWeight="800"
            color={tone === 'accent' ? palette.accentLimeText : palette.ink}
          >
            {label}
          </Text>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
