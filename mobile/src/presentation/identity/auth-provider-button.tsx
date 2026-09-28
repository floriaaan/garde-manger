import type { ReactNode } from 'react'
import { ActivityIndicator, Animated } from 'react-native'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple, rippleClip } from '../shared/material.js'
import { Pressable } from '../shared/pressable.js'

/** Shared size and interaction for icon-only methods, with Apple's white surface. */
export function AuthProviderButton({
  label,
  testID,
  icon,
  onPress,
  pending,
  disabled,
  surface = 'cream',
  onHint,
}: {
  label: string
  testID: string
  icon: ReactNode
  onPress: () => void
  pending: boolean
  disabled: boolean
  surface?: 'cream' | 'white'
  onHint?: (label: string | null) => void
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  const backgroundColor = surface === 'white' ? palette.onDark : palette.authMethodSurface

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onHoverIn={() => { hover.onHoverIn(); onHint?.(label) }}
      onHoverOut={() => { hover.onHoverOut(); onHint?.(null) }}
      onFocus={() => onHint?.(label)}
      onBlur={() => onHint?.(null)}
      onLongPress={() => onHint?.(label)}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Maintenir pour afficher le nom de cette méthode"
      accessibilityState={{ disabled, busy: pending }}
      android_ripple={ripple(palette.accentLimeText)}
      style={[pointerCursor, rippleClip(16), { flexGrow: 1, flexBasis: 0, minWidth: 0, height: 56 }]}
    >
      <Animated.View
        style={{
          flex: 1,
          borderRadius: 16,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: hover.scale }],
          opacity: disabled && !pending ? 0.6 : 1,
        }}
      >
        {pending ? <ActivityIndicator color={palette.accentLimeText} /> : icon}
      </Animated.View>
    </Pressable>
  )
}
