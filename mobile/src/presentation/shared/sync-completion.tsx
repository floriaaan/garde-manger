import { useCallback, useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Platform } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useTranslation } from '../../i18n/index.js'
import { CircleCheckIcon, ClockIcon, SparklesIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReduceMotion, useScreenReader } from './hover.js'
import { PillButton } from './pill-button.js'
import { Text, YStack } from './tamagui-typed.js'

/** A brief, interruptible success beat; the timer never dismisses a different route. */
export function SyncCompletion({ onDone, synced = 0, cancelled = 0 }: { onDone: () => void; synced?: number; cancelled?: number }) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const reduced = useReduceMotion()
  const screenReader = useScreenReader()
  const [interacting, setInteracting] = useState(false)
  const [pop] = useState(() => new Animated.Value(0))
  const title = t(cancelled ? synced ? 'sync.resolved' : 'sync.cancelled_title' : 'sync.all_set')
  const summary = [synced ? t('sync.delivered_count', { count: synced }) : '', cancelled ? t('sync.cancelled_count', { count: cancelled }) : ''].filter(Boolean).join(' · ')
  const celebrate = synced > 0 && cancelled === 0
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${title}. ${summary}`)
    if (reduced || !celebrate) return
    const animation = Animated.spring(pop, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true })
    animation.start()
    return () => animation.stop()
  }, [pop, reduced, title, summary, celebrate])
  useFocusEffect(useCallback(() => {
    if (interacting) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    async function schedule() {
      // Resolve the native preference before starting a short dismissal timer.
      const reader = await AccessibilityInfo.isScreenReaderEnabled?.().catch(() => true)
      const base = reader || screenReader ? 8000 : reduced ? 3500 : 1800
      const duration = Platform.OS === 'android'
        ? await AccessibilityInfo.getRecommendedTimeoutMillis(base).catch(() => base) : base
      if (active) timer = setTimeout(onDone, Math.max(base, duration))
    }
    void schedule()
    return () => { active = false; clearTimeout(timer) }
  }, [onDone, reduced, screenReader, interacting]))
  const Icon = cancelled ? ClockIcon : CircleCheckIcon
  return <YStack flex={1} alignItems="center" justifyContent="center" gap="$5" padding="$6"
    onTouchStart={() => setInteracting(true)} onFocus={() => setInteracting(true)}>
    <Animated.View style={{ transform: reduced || !celebrate ? [] : [
      { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
      { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
    ] }} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <YStack width={96} height={96} borderRadius={32} backgroundColor={cancelled ? palette.cream : palette.freshBg}
        alignItems="center" justifyContent="center">
        <Icon size={54} color={cancelled ? palette.ink : palette.freshText} />
        {!cancelled ? <YStack position="absolute" right={-10} top={-10}><SparklesIcon size={26} color={palette.lavenderText} /></YStack> : null}
      </YStack>
    </Animated.View>
    <Text testID="sync-completion" role="status" accessibilityLiveRegion="polite"
      fontSize={26} lineHeight={34} fontWeight="800" textAlign="center" color={palette.ink}>{title}</Text>
    {summary ? <Text fontSize={14} lineHeight={21} textAlign="center" color={palette.inkSecondary}>{summary}</Text> : null}
    <PillButton label={t('shared.close')} palette={palette} tone="quiet" size="dense" centered onPress={onDone} />
  </YStack>
}
