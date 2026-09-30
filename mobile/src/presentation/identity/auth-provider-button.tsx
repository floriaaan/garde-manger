import type { ReactNode } from 'react'
import { ActivityIndicator, Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { Text } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple, rippleClip } from '../shared/material.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/** Compact, visibly named methods share one row; full action names stay accessible. */
export function AuthProviderButton({ name, label, icon, testID, pending, disabled, onPress, apple = false }: {
  name: string
  label: string
  icon: ReactNode
  testID: string
  pending: boolean
  disabled: boolean
  onPress: () => void
  apple?: boolean
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  const ink = apple ? palette.accentLimeText : palette.ink
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy: pending }}
      onHoverIn={hover.onHoverIn} onHoverOut={hover.onHoverOut} onPressIn={hover.onPressIn} onPressOut={hover.onPressOut}
      android_ripple={ripple(ink)} style={[pointerCursor, rippleClip(11), { flex: 1, minWidth: 0 }]}>
      <Animated.View style={{ minHeight: 68, padding: 8, borderRadius: 11, borderWidth: 1.25, borderColor: ink, backgroundColor: apple ? palette.authMethodSurface : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: disabled ? 0.6 : 1, transform: [{ scale: hover.scale }] }}>
        {pending ? <ActivityIndicator color={ink} size="small" /> : icon}
        <Text fontSize={12} fontWeight="700" color={ink} textAlign="center">{name}</Text>
      </Animated.View>
    </Pressable>
  )
}
