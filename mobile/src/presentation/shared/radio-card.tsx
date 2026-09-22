import type { ReactNode } from 'react'
import { Animated } from 'react-native'
import { Pressable } from './pressable.js'
import * as Haptics from 'expo-haptics'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import { ripple, rippleClip } from './material.js'
import { haptic } from './haptics.js'
import { CircleCheckIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * A card-shaped radio option — generalized from `TodoEntityRow`
 * (home-assistant/todo-entity-picker), which drew this same shape once for
 * a single screen. Same card-float shadow and selected/unselected
 * background+text swap, now reusable for any single-choice list (AI
 * provider, and future pickers) instead of re-copied per screen.
 */
export function RadioCard({
  testID,
  label,
  description,
  selected,
  onPress,
  icon,
  iconTint,
  disabled,
  palette,
}: {
  testID: string
  label: string
  description?: string
  selected: boolean
  onPress: () => void
  /** Rendered inside a 36×36 tinted chip, left of the label — omit for a plain radio row. */
  icon?: (color: string) => ReactNode
  iconTint?: string
  disabled?: boolean
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  const bg = selected ? palette.mintPale : palette.gradientBottom
  const textColor = selected ? palette.mintPaleText : palette.ink
  const subColor = selected ? palette.mintPaleText : palette.inkSecondary

  function handlePress() {
    if (!selected) haptic(() => Haptics.selectionAsync())
    onPress()
  }

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      // Fires its own selection tick from `handlePress`, and only when the
      // selection really changes — not the default confirmation tick.
      haptics={false}
      disabled={disabled}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      android_ripple={ripple(palette.ink)}
      style={[pointerCursor, disabled ? { opacity: 0.5 } : null, rippleClip(16)]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="center"
          gap="$3"
          paddingVertical="$3"
          paddingHorizontal="$3"
          minHeight={56}
          borderRadius={16}
          backgroundColor={bg}
          style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 }}
        >
          {icon ? (
            <YStack width={36} height={36} borderRadius={12} backgroundColor={iconTint ?? palette.chipViolet} alignItems="center" justifyContent="center">
              {icon(palette.onDark)}
            </YStack>
          ) : null}
          <YStack flex={1} minWidth={0}>
            <Text fontSize={14} fontWeight="700" color={textColor}>
              {label}
            </Text>
            {description ? (
              <Text fontSize={12} color={subColor}>
                {description}
              </Text>
            ) : null}
          </YStack>
          {selected ? <CircleCheckIcon size={18} color={palette.mintPaleText} /> : null}
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
