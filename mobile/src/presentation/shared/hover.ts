import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native'
import { IS_ANDROID } from './material.js'

/**
 * Web-only pointer affordance for every `Pressable` in the app — RN silently
 * ignores unknown style keys on native, so this is safe to spread
 * unconditionally, but `Platform.select` keeps the intent explicit.
 *
 * `textAlign` rides along because RN Web renders `accessibilityRole="button"`
 * as a real `<button>`, and the UA stylesheet centres a button's text. Every
 * card in this app that is also a control — recipe rows, product rows, nav
 * cards — was therefore centring its title and its body copy on web only,
 * against a left-aligned layout everywhere else. It is a browser default
 * leaking into the design, not a decision; labels that are meant to be centred
 * (the pills, the auth buttons) are centred by their own flex box and are
 * unaffected. `start`, not `left`, so the rule follows the writing direction
 * rather than re-hardcoding a second browser assumption in place of the first.
 */
export const pointerCursor = Platform.select({
  web: { cursor: 'pointer' as const, textAlign: 'start' as const },
  default: {},
})

/**
 * `hitSlop`, for the web build that does not implement it.
 *
 * This system's single answer to the 44pt touch target is "don't grow the
 * control, grow its press area" — `Chip` is 32pt tall for exactly that reason,
 * and the recipe row's overflow control is 28. `react-native-web` ignores
 * `hitSlop` entirely, so on web every one of those controls was its drawn size
 * and under the floor, while the code read as compliant. Negative margin plus
 * matching padding is the same trick in CSS: the press box grows, the layout
 * does not move. Spread it *alongside* `hitSlop`, never instead of it — native
 * keeps the real prop, and the negative margin is a no-op there only because
 * this branch is web-only.
 *
 * `top`/`bottom` and `left`/`right` are separate because a row of chips shares
 * its horizontal room with its neighbours: DESIGN.md's rule that a chip row
 * needs `gap="$3"` exists so two facing press areas do not overlap, and a wide
 * horizontal expansion here would re-create the overlap it was written to
 * prevent.
 */
export function pressAreaSlop(vertical: number, horizontal = 4) {
  return Platform.select({
    web: {
      marginVertical: -vertical,
      marginHorizontal: -horizontal,
      paddingVertical: vertical,
      paddingHorizontal: horizontal,
    },
    default: {},
  })
}

/**
 * Tracks the OS "Reduce Motion" setting (iOS/Android; RN Web maps this to
 * `prefers-reduced-motion` on modern versions). An audit found every
 * animation in the app — hover/press springs, the hero entrance — ignored
 * this setting entirely.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (mounted) setReduced(value)
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) => {
      setReduced(value)
    })
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])
  return reduced
}

/** Tracks VoiceOver / TalkBack. Gesture-only affordances need a visible twin while it is on. */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isScreenReaderEnabled?.()
      .then((value) => {
        if (mounted) setEnabled(value)
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])
  return enabled
}

/**
 * Default drift range for `useBlobDrift`, exported so a caller sizing the
 * oversized layer that motion happens inside (see `BlobBackground`'s
 * comment on why that layer must overhang its own box by exactly this much)
 * uses the same numbers instead of a second, driftable copy of them.
 *
 * `X` is asymmetric — much more travel right (60) than left (10) — two
 * follow-ups from the first pass, which was a plain ±10 either side and
 * read as barely moving toward the leading (right) edge.
 */
export const BLOB_DRIFT_X_RANGE: [number, number] = [-10, 60]
export const BLOB_DRIFT_Y = 6

/**
 * A slow, gentle back-and-forth drift — for `BlobBackground`/`AuthBlobBackground`,
 * which otherwise sit dead-still behind every screen. Sine easing both ways
 * (`inOut`) so it never has a sharp turnaround, and the whole cycle is slow
 * enough (default 8s each leg) to read as "the ground is breathing," not as
 * a decoration competing with the content in front of it.
 *
 * Respects Reduce Motion the same way `useHoverPress` does: frozen at rest
 * (`transform: []`) rather than an instant jump to some mid-cycle position.
 */
export function useBlobDrift({ rangeX = BLOB_DRIFT_X_RANGE, amplitudeY = BLOB_DRIFT_Y, duration = 8000 } = {}) {
  const reduceMotion = useReduceMotion()
  // `Animated.Value` is RN's mutable animation primitive, not a React ref
  // this rule targets; reading `.current` synchronously here is the
  // documented pattern for driving `Animated.timing`/`interpolate` from a
  // stable value across renders.
  // eslint-disable-next-line react-hooks/refs
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduceMotion) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [reduceMotion, duration, progress])

  if (reduceMotion) return { transform: [] }
  return {
    transform: [
      // eslint-disable-next-line react-hooks/refs -- same Animated.Value read as above
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: rangeX }) },
      // eslint-disable-next-line react-hooks/refs -- same Animated.Value read as above
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-amplitudeY, amplitudeY] }) },
    ],
  }
}

/**
 * Hover (web) + press (all platforms) feedback as one spring-driven scale.
 * RN Web's `Pressable` fires `onHoverIn`/`onHoverOut`; native ignores them.
 *
 * With Reduce Motion on, the scale still applies (it's the state-change
 * signal — a press did register) but instantly, via `Animated.timing`
 * with `duration: 0`, instead of a bouncy spring: the craft floor's rule
 * is "preserve state change and hierarchy," not "kill all feedback."
 *
 * **On Android the scale does not apply at all.** Material's touch feedback is
 * a ripple bounded by the control, and a control that both ripples and shrinks
 * reads as two responses to one tap. Callers pass `android_ripple={ripple(…)}`
 * (see material.ts) and get a flat `scale` of 1 here, so the same component
 * feels like iOS on iOS and like Material on Android without a fork.
 */
export function useHoverPress() {
  const [scale] = useState(() => new Animated.Value(1))
  const reduceMotion = useReduceMotion()
  function to(value: number, friction: number) {
    if (IS_ANDROID) return
    if (reduceMotion) {
      Animated.timing(scale, { toValue: value, duration: 0, useNativeDriver: true }).start()
      return
    }
    Animated.spring(scale, { toValue: value, friction, tension: 200, useNativeDriver: true }).start()
  }
  return {
    scale,
    onHoverIn: () => to(1.035, 6),
    onHoverOut: () => to(1, 6),
    onPressIn: () => to(0.96, 5),
    onPressOut: () => to(1, 4),
  }
}
