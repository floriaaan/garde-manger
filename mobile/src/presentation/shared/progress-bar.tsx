/**
 * The app's "working on it" bar, for the AI tasks that run on the server.
 *
 * Two shapes, one control. With `value`/`total` it is *determinate* — the
 * fridge scan really knows "3 photos out of 5" — and the fill glides to each
 * new step rather than jumping. Without them it is *indeterminate*: a band
 * sweeps the track for the calls whose duration nobody can promise (a receipt,
 * a recipe). Both sit on the same `freshBg` track `Meter` uses, so a bar that
 * fills and a bar that sweeps read as the same family.
 *
 * Reduce Motion: no sweep, no glide. The indeterminate bar holds a static
 * partial fill (still visibly a loader, it just stops travelling) and the
 * determinate one snaps. Same rule as `Skeleton` and `PulseDots`.
 */
import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { YStack } from './tamagui-typed.js'
import { useReduceMotion } from './hover.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

const TRACK_HEIGHT = 8
const BAND_RATIO = 0.4
const SWEEP_MS = 1300
const STATIC_FILL = 0.35

export function ProgressBar({
  palette,
  value,
  total,
  testID,
  label = 'Chargement',
}: {
  palette: SoftPalette
  /** Units done. Omit (with `total`) for the indeterminate sweep. */
  value?: number
  total?: number
  testID?: string
  /** Announced by screen readers; the determinate bar appends its own "x sur y". */
  label?: string
}) {
  const reduceMotion = useReduceMotion()
  const [width, setWidth] = useState(0)
  const [sweep] = useState(() => new Animated.Value(0))
  const [fill] = useState(() => new Animated.Value(0))

  const determinate = value !== undefined && total !== undefined && total > 0
  const ratio = determinate ? Math.max(0, Math.min(1, value / total)) : 0

  useEffect(() => {
    if (determinate || reduceMotion) return
    sweep.setValue(0)
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [determinate, reduceMotion, sweep])

  useEffect(() => {
    if (!determinate) return
    if (reduceMotion) {
      fill.setValue(ratio)
      return
    }
    Animated.timing(fill, { toValue: ratio, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: false }).start()
  }, [determinate, ratio, reduceMotion, fill])

  const bandWidth = width * BAND_RATIO

  return (
    <YStack
      testID={testID}
      height={TRACK_HEIGHT}
      borderRadius={999}
      backgroundColor={palette.freshBg}
      overflow="hidden"
      onLayout={(event: { nativeEvent: { layout: { width: number } } }) => setWidth(event.nativeEvent.layout.width)}
      accessible
      role="progressbar"
      accessibilityLabel={determinate ? `${label} : ${value} sur ${total}` : label}
      accessibilityValue={determinate ? { min: 0, max: total, now: value } : undefined}
    >
      {determinate ? (
        <Animated.View
          style={{
            height: TRACK_HEIGHT,
            borderRadius: 999,
            backgroundColor: palette.fresh,
            width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      ) : reduceMotion ? (
        <Animated.View
          style={{ height: TRACK_HEIGHT, borderRadius: 999, backgroundColor: palette.fresh, width: `${STATIC_FILL * 100}%` }}
        />
      ) : (
        <Animated.View
          style={{
            height: TRACK_HEIGHT,
            width: bandWidth,
            borderRadius: 999,
            backgroundColor: palette.fresh,
            transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-bandWidth, width] }) }],
          }}
        />
      )}
    </YStack>
  )
}
