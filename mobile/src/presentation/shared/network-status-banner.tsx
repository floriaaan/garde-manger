import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useConnectivity } from '../../application/shared/use-connectivity.js'
import { useTranslation } from '../../i18n/index.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { CircleCheckIcon, WifiOffIcon } from '../dashboard/dashboard-icons.js'
import { useReduceMotion } from './hover.js'
import { Text, XStack, YStack } from './tamagui-typed.js'

/** Reserve space instead of covering navigation or blocking touches with an overlay. */
export function NetworkStatusBanner() {
  const online = useConnectivity()
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const [height] = useState(() => new Animated.Value(0))
  const [contentHeight, setContentHeight] = useState(0)
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<'offline' | 'restored' | null>(null)
  useEffect(() => {
    if (online === false) { setStatus('offline'); setVisible(true) }
    else if (online === true) setStatus((previous) => previous === 'offline' ? 'restored' : previous)
  }, [online])
  useEffect(() => {
    if (status !== 'restored') return
    const timer = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(timer)
  }, [status])
  const title = status ? t(`shared.network_${status}`) : ''
  const description = status === 'offline' ? t('shared.network_offline_description') : ''
  const message = description ? `${title}. ${description}` : title
  useEffect(() => {
    if (!status) return
    const target = visible ? contentHeight : 0
    if (reduceMotion || contentHeight === 0) {
      height.setValue(target)
      if (!visible) setStatus(null)
      return
    }
    // One small measured region animates in normal flow, including its safe-area inset.
    // Keeping text opaque preserves contrast while the viewport progressively makes room.
    const animation = Animated.timing(height, {
      toValue: target,
      duration: visible ? 240 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: false,
    })
    animation.start(({ finished }) => { if (finished && !visible) setStatus(null) })
    return () => animation.stop()
  }, [status, visible, contentHeight, reduceMotion, height])
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message)
  }, [message])
  if (!status) return null
  const offline = status === 'offline'
  const color = offline ? palette.soonText : palette.freshText
  const Icon = offline ? WifiOffIcon : CircleCheckIcon
  return (
    <Animated.View style={{ height, overflow: 'hidden', flexShrink: 0,
      backgroundColor: offline ? palette.soonBg : palette.freshBg }}>
      <SafeAreaView testID="network-status-content" edges={['top', 'left', 'right']}
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <XStack testID="network-status-banner" role="status" accessible
          accessibilityLabel={message} accessibilityLiveRegion="polite"
          paddingHorizontal={24} paddingVertical={12} gap={12} alignItems="center"
          alignSelf="center" width="100%" maxWidth={640}>
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
      </SafeAreaView>
    </Animated.View>
  )
}
