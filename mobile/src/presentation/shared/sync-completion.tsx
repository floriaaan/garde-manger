import { useCallback, useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Platform } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useTranslation } from '../../i18n/index.js'
import { CircleCheckIcon, SparklesIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReduceMotion } from './hover.js'
import { PillButton } from './pill-button.js'
import { Text, YStack } from './tamagui-typed.js'

/** A brief, interruptible success beat; the timer never dismisses a different route. */
export function SyncCompletion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const reduced = useReduceMotion()
  const [pop] = useState(() => new Animated.Value(0))
  const title = t('sync.all_set')
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(title)
    if (reduced) return
    const animation = Animated.spring(pop, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true })
    animation.start()
    return () => animation.stop()
  }, [pop, reduced, title])
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(onDone, 1800)
    return () => clearTimeout(timer)
  }, [onDone]))
  return <YStack flex={1} alignItems="center" justifyContent="center" gap="$5" padding="$6">
    <Animated.View style={{ transform: reduced ? [] : [
      { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
      { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
    ] }} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <YStack width={96} height={96} borderRadius={32} backgroundColor={palette.freshBg}
        alignItems="center" justifyContent="center">
        <CircleCheckIcon size={54} color={palette.freshText} />
        <YStack position="absolute" right={-10} top={-10}><SparklesIcon size={26} color={palette.lavenderText} /></YStack>
      </YStack>
    </Animated.View>
    <Text testID="sync-completion" role="status" accessibilityLiveRegion="polite"
      fontSize={26} lineHeight={34} fontWeight="800" textAlign="center" color={palette.ink}>{title}</Text>
    <PillButton label={t('shared.close')} palette={palette} tone="quiet" size="dense" centered onPress={onDone} />
  </YStack>
}
