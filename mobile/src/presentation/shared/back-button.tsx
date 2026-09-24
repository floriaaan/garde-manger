import { Animated } from 'react-native'
import { Pressable } from './pressable.js'
import { pointerCursor, useHoverPress } from './hover.js'
import { ArrowLeftIcon } from '../dashboard/dashboard-icons.js'
import { ripple } from './material.js'

/** Shared across screens (recipe, shopping-list) — was duplicated verbatim in both before this file existed. */
export function BackButton({ onPress, ink, cream }: { onPress: () => void; ink: string; cream: string }) {
  const hover = useHoverPress()
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      android_ripple={ripple(ink, { borderless: true, radius: 24 })}
      style={pointerCursor}
    >
      <Animated.View
        style={{
          transform: [{ scale: hover.scale }],
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: cream,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* A drawn icon, not the `←` character it used to set in a Text: a
            unicode glyph carries the font's weight and baseline, not this
            app's 2px round stroke, and renders differently per platform. */}
        <ArrowLeftIcon size={18} color={ink} />
      </Animated.View>
    </Pressable>
  )
}
