/**
 * One-shot confetti burst for a moment worth marking (a subscription just
 * confirmed). Pieces fall from above the top edge in the app's own pastel
 * chips + lime, then the overlay removes itself via `onDone`. Skipped under
 * Reduce Motion. Pointer-transparent, so it never blocks the screen.
 */
import { useCallback, useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { subscribeConfetti } from '../../application/shared/confetti.js'
import { useReduceMotion } from './hover.js'
import { useSoftPalette, type SoftPalette } from '../dashboard/soft-palette.js'

const PIECES = 40
const MAX_MS = 3400

function Piece({ color, x, drift, spin, size, delay, duration, height }: PieceSpec & { height: number }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration, easing: Easing.in(Easing.quad) }))
  }, [t, delay, duration])
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
    transform: [
      { translateX: drift * t.value },
      { translateY: -24 + (height + 48) * t.value },
      { rotate: `${spin * t.value}deg` },
    ],
  }))
  return (
    <Reanimated.View
      style={[
        { position: 'absolute', top: 0, left: x, width: size, height: size * 0.55, borderRadius: 2, backgroundColor: color },
        style,
      ]}
    />
  )
}

interface PieceSpec {
  color: string
  x: number
  drift: number
  spin: number
  size: number
  delay: number
  duration: number
}

function makePieces(palette: SoftPalette, width: number): PieceSpec[] {
  const colors = [palette.accentLime, palette.chipViolet, palette.chipTeal, palette.chipOrange, palette.chipButter]
  return Array.from({ length: PIECES }, (_, i) => ({
    color: colors[i % colors.length]!,
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 120,
    spin: (Math.random() - 0.5) * 900,
    size: 8 + Math.random() * 8,
    delay: Math.random() * 500,
    duration: 1800 + Math.random() * 1200,
  }))
}

export function Confetti({ palette, onDone }: { palette: SoftPalette; onDone: () => void }) {
  const { width, height } = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  // Random once per burst (lazy initial state; the randomness lives in `makePieces`).
  const [pieces] = useState(() => makePieces(palette, width))

  useEffect(() => {
    const timer = setTimeout(onDone, reduceMotion ? 0 : MAX_MS)
    return () => clearTimeout(timer)
  }, [onDone, reduceMotion])

  if (reduceMotion) return null
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {pieces.map((piece, i) => (
        <Piece key={i} {...piece} height={height} />
      ))}
    </View>
  )
}

export function ConfettiHost() {
  const palette = useSoftPalette()
  // A counter as the key restarts the burst if one fires while another is still falling.
  const [burst, setBurst] = useState<number | null>(null)
  useEffect(() => {
    return subscribeConfetti(() => setBurst((n) => (n ?? 0) + 1))
  }, [])
  const done = useCallback(() => setBurst(null), [])
  return burst === null ? null : <Confetti key={burst} palette={palette} onDone={done} />
}
