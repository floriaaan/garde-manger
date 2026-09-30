import { useCallback, useEffect, useState } from 'react'
import { Animated, AppState, Easing, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { LeafIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useReduceMotion } from './hover.js'

/** Indeterminate activity: a leaf travels the pantry rail, without implying a percentage. */
export function PantryLoader({ palette, label = 'Chargement', testID }: {
  palette: SoftPalette
  label?: string
  testID?: string
}) {
  const reduced = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(0))
  const [focused, setFocused] = useState(false)
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive')

  useFocusEffect(useCallback(() => {
    setFocused(true)
    return () => setFocused(false)
  }, []))

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'))
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (reduced || !focused || !foreground) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]), { resetBeforeIteration: false })
    loop.start()
    return () => loop.stop()
  }, [progress, reduced, focused, foreground])

  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ width: 108, height: 32 }}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 14, right: 14, top: 15, height: 2, borderRadius: 1, backgroundColor: palette.creamPillEdge }} />
      <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 2, left: 0, width: 28, height: 28, borderRadius: 10, backgroundColor: palette.blobSoft, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: reduced ? 40 : progress.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) }] }}>
        <LeafIcon size={20} color={palette.ink} />
      </Animated.View>
    </View>
  )
}
