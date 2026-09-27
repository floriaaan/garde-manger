import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Reanimated, { Easing as MotionEasing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export type AuthMode = 'sign-in' | 'sign-up'

export interface AuthPage {
  title: string
  subtitle: string
  content: ReactNode
}

/** Both panels stay mounted: swipes follow the finger and typed fields survive tab changes. */
export function AuthModePager({
  mode,
  onModeChange,
  pages,
  width,
  fontScale,
  reduceMotion,
  palette,
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  pages: { signIn: AuthPage; signUp: AuthPage }
  width: number
  fontScale: number
  reduceMotion: boolean
  palette: SoftPalette
}) {
  const selected = mode === 'sign-up' ? 1 : 0
  const offset = useSharedValue(-selected * width)
  const start = useSharedValue(0)
  const [heights, setHeights] = useState<[number, number]>([0, 0])
  const [viewportHeight] = useState(() => new Animated.Value(0))
  const [measured, setMeasured] = useState(false)

  useEffect(() => {
    offset.value = withTiming(-selected * width, {
      duration: reduceMotion ? 0 : 280,
      easing: MotionEasing.out(MotionEasing.cubic),
    })
  }, [offset, selected, width, reduceMotion])

  useEffect(() => {
    const target = heights[selected]
    if (!target) return
    if (!measured) {
      viewportHeight.setValue(target)
      setMeasured(true)
      return
    }
    Animated.timing(viewportHeight, {
      toValue: target,
      duration: reduceMotion ? 0 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [heights, selected, viewportHeight, measured, reduceMotion])

  const pan = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onStart(() => {
      start.value = offset.value
    })
    .onUpdate((event) => {
      const raw = start.value + event.translationX
      offset.value = raw > 0 ? raw * 0.18 : raw < -width ? -width + (raw + width) * 0.18 : raw
    })
    .onEnd((event) => {
      const projected = event.translationX + event.velocityX * 0.12
      const next = selected === 0 && projected < -width * 0.2
        ? 1
        : selected === 1 && projected > width * 0.2 ? 0 : selected
      offset.value = withTiming(-next * width, {
        duration: reduceMotion ? 0 : 280,
        easing: MotionEasing.out(MotionEasing.cubic),
      })
      if (next !== selected) runOnJS(onModeChange)(next === 1 ? 'sign-up' : 'sign-in')
    })
    .onFinalize((_event, success) => {
      if (!success) offset.value = withTiming(-selected * width, { duration: reduceMotion ? 0 : 220 })
    })

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }))
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -offset.value / 2 }] }))

  function measure(index: 0 | 1, height: number) {
    setHeights((current) => {
      if (Math.abs(current[index] - height) < 1) return current
      const next: [number, number] = [...current]
      next[index] = height
      return next
    })
  }

  return (
    <View style={{ gap: 20 }}>
      <View
        accessibilityRole="tablist"
        style={{ position: 'relative', flexDirection: 'row' }}
      >
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: palette.cream, opacity: 0.35 }}
        />
        {([
          { key: 'sign-in', label: 'Se connecter' },
          { key: 'sign-up', label: 'Créer un compte' },
        ] as const).map((tab) => (
          <Pressable
            key={tab.key}
            testID={`auth-tab-${tab.key}`}
            onPress={() => onModeChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === tab.key }}
            style={[pointerCursor, { width: width / 2, minHeight: 52, alignItems: 'center', justifyContent: 'center' }]}
          >
            <Text
              fontSize={15}
              fontWeight={mode === tab.key ? '800' : '600'}
              color={mode === tab.key ? palette.onDark : palette.onDarkSecondary}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
        <Reanimated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: 0, bottom: 0, width: width / 2, height: 4, borderRadius: 999, backgroundColor: palette.accentLime }, indicatorStyle]}
        />
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={{ width, overflow: 'hidden', ...(measured ? { height: viewportHeight } : {}) }}>
          <Reanimated.View style={[{ flexDirection: 'row', width: width * 2, alignItems: 'flex-start' }, trackStyle]}>
            {([pages.signIn, pages.signUp] as const).map((page, index) => (
              <View
                key={index}
                onLayout={(event) => measure(index as 0 | 1, event.nativeEvent.layout.height)}
                pointerEvents={selected === index ? 'auto' : 'none'}
                accessibilityElementsHidden={selected !== index}
                importantForAccessibility={selected === index ? 'auto' : 'no-hide-descendants'}
                style={{ width, gap: 20 }}
              >
                <YStack gap="$1">
                  <Text fontSize={24} fontWeight="800" lineHeight={30 * fontScale} color={palette.onDark}>
                    {page.title}
                  </Text>
                  <Text fontSize={14} fontWeight="500" lineHeight={20 * fontScale} color={palette.onDarkSecondary}>
                    {page.subtitle}
                  </Text>
                </YStack>
                {page.content}
              </View>
            ))}
          </Reanimated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
