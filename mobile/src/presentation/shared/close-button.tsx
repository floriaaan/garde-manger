import { Animated } from 'react-native'
import { Pressable } from './pressable.js'
import { YStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import { ripple } from './material.js'
import { XIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * The trailing "Fermer" of a screen presented as a modal. A back arrow says
 * "one step back along a path"; a sheet has no path, it was laid over the
 * screen and closing it is the only way out — web, with no swipe to dismiss,
 * has nothing else.
 */
export function CloseButton({ testID, palette, onPress }: { testID?: string; palette: SoftPalette; onPress: () => void }) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Fermer"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      android_ripple={ripple(palette.creamPillEdge, { borderless: true })}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <YStack width={38} height={38} borderRadius={999} backgroundColor={palette.cream} alignItems="center" justifyContent="center">
          <XIcon size={18} color={palette.ink} />
        </YStack>
      </Animated.View>
    </Pressable>
  )
}
