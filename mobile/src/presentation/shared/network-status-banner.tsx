import { useCallback, useEffect, useRef, useState } from 'react'
import { router } from 'expo-router'
import type { MutationQueue } from '../../application/sync/mutation-queue.js'
import { useSyncStatus } from '../../application/sync/use-sync-status.js'
import { PillButton } from './pill-button.js'
import { AccessibilityInfo, Platform } from 'react-native'
import Reanimated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useConnectivity } from '../../application/shared/use-connectivity.js'
import { useTranslation } from '../../i18n/index.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { CircleCheckIcon, WifiOffIcon, RefreshIcon, TriangleAlertIcon, ClockIcon } from '../dashboard/dashboard-icons.js'
import { useReduceMotion } from './hover.js'
import { Text, XStack, YStack } from './tamagui-typed.js'

/** Reserve space instead of covering navigation or blocking touches with an overlay. */
export function NetworkStatusBanner({ queue = null }: { queue?: MutationQueue | null }) {
  const sync = useSyncStatus(queue)
  const failures = sync.entries.filter((entry) => entry.error).length
  const online = useConnectivity()
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const height = useSharedValue(0)
  const animationRevision = useRef(0)
  const animatedStyle = useAnimatedStyle(() => ({ height: height.get() }))

  const [contentHeight, setContentHeight] = useState(0)
  const [visible, setVisible] = useState(false)
  const [previousOnline, setPreviousOnline] = useState<boolean | undefined>(undefined)
  const [status, setStatus] = useState<'offline' | 'restored' | null>(null)
  const finishClosing = useCallback((revision: number) => {
    if (animationRevision.current === revision) setStatus(null)
  }, [])
  useEffect(() => {
    if (status !== 'restored') return
    const timer = setTimeout(() => {
      setVisible(false)
      if (reduceMotion) setStatus(null)
    }, 3500)
    return () => clearTimeout(timer)
  }, [status, reduceMotion])
  const syncState = sync.storageUnavailable ? 'storage_error' : failures ? 'failed' :
    sync.syncing ? 'syncing' : sync.entries.length ? 'pending' : null
  const activeStatus = status === 'offline' ? 'offline' : syncState ?? status
  const shown = Boolean(syncState) || visible
  const title = activeStatus ? t(`shared.network_${activeStatus}`) : ''
  const description = sync.entries.length
    ? t('sync.pending_count', { count: sync.entries.length })
    : activeStatus === 'offline' ? t('shared.network_offline_description')
    : activeStatus === 'storage_error' ? t('sync.storage_error_description') : ''
  const message = description ? `${title}. ${description}` : title
  useEffect(() => {
    if (!activeStatus) { height.set(0); return }
    const target = shown ? contentHeight : 0
    if (reduceMotion) { height.set(target); return }
    // Animate on the UI thread; JS-driven height updates compete with navigation.
    const revision = ++animationRevision.current
    height.set(withTiming(target, {
      duration: contentHeight === 0 ? 0 : shown ? 240 : 180,
      easing: shown ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
    }, (finished) => {
      if (finished && !shown) scheduleOnRN(finishClosing, revision)
    }))
    return () => {
      ++animationRevision.current
      cancelAnimation(height)
    }
  }, [activeStatus, shown, contentHeight, reduceMotion, height, finishClosing])
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message)
  }, [message])
  // A guarded render update synchronizes connectivity before committing stale content.
  if (previousOnline !== online) {
    setPreviousOnline(online)
    if (online === false) { setStatus('offline'); setVisible(true) }
    else if (online === true && status === 'offline') setStatus('restored')
  }
  if (!activeStatus) return null
  const warning = ['offline', 'pending', 'failed', 'storage_error'].includes(activeStatus)
  const color = warning ? palette.soonText : palette.freshText
  const Icon = activeStatus === 'offline' ? WifiOffIcon : activeStatus === 'syncing' ? RefreshIcon :
    activeStatus === 'pending' ? ClockIcon : activeStatus === 'restored' ? CircleCheckIcon : TriangleAlertIcon
  return (
    <Reanimated.View testID="network-status-region" style={[animatedStyle, { overflow: 'hidden', flexShrink: 0,
      backgroundColor: warning ? palette.soonBg : palette.freshBg }]}>
      <SafeAreaView testID="network-status-content" edges={['top', 'left', 'right']}
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <XStack paddingHorizontal={24} paddingVertical={12} gap={12} alignItems="center"
          alignSelf="center" width="100%" maxWidth={640} flexWrap="wrap">
          <XStack testID="network-status-banner" role="status" accessible
            accessibilityLabel={message} accessibilityLiveRegion="polite" flex={1} gap={12} alignItems="center">
            <YStack flexShrink={0} accessible={false} accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants" aria-hidden>
              <Icon size={22} color={color} />
            </YStack>
            <YStack flex={1} minWidth={0} gap={2}>
              <Text fontSize={14} fontWeight="800" lineHeight={20} color={color}>
                {title}
              </Text>
              {description ? <Text fontSize={13} fontWeight="500" lineHeight={18} color={color}>
                {description}
              </Text> : null}
            </YStack>
          </XStack>
          {activeStatus === 'offline' || sync.entries.length || sync.storageUnavailable ? <PillButton label={t('sync.details')} palette={palette}
            tone="quiet" onPress={() => router.push('/pending-actions')} accessibilityLabel={t('sync.open_details')} /> : null}
        </XStack>
      </SafeAreaView>
    </Reanimated.View>
  )
}
