import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, type ViewProps } from 'react-native'
import { useReduceMotion } from '../shared/hover.js'
import { IS_ANDROID, MATERIAL_MOTION } from '../shared/material.js'

/** Explain an intent change without remounting inputs or animating keyboard layout. */
export function AuthStep({ active, direction = 1, style, children, ...props }: ViewProps & {
  active: boolean
  direction?: -1 | 1
}) {
  const reduced = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(1))
  const wasActive = useRef(active)

  useEffect(() => {
    const activating = active && !wasActive.current
    wasActive.current = active
    progress.stopAnimation()
    if (!activating) {
      progress.setValue(1)
      return
    }
    progress.setValue(0.6)
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 100 : IS_ANDROID ? MATERIAL_MOTION.short + 100 : 280,
      easing: IS_ANDROID ? MATERIAL_MOTION.decelerate : Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [active, reduced, progress])

  return (
    <Animated.View
      {...props}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[style, {
        display: active ? 'flex' : 'none',
        // Full opacity during ordinary switching: no form fade-in.
        opacity: reduced ? progress : 1,
        transform: reduced ? [] : [{ translateX: progress.interpolate({ inputRange: [0.6, 1], outputRange: [direction * 32, 0], extrapolate: 'clamp' }) }],
      }]}
    >
      {children}
    </Animated.View>
  )
}
