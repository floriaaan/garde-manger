import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Platform } from 'react-native'
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
  const [offset] = useState(() => new Animated.Value(0))
  const [status, setStatus] = useState<'offline' | 'restored' | null>(null)
  useEffect(() => {
    if (online === false) setStatus('offline')
    else if (online === true) setStatus((previous) => previous === 'offline' ? 'restored' : previous)
  }, [online])
  useEffect(() => {
    if (status !== 'restored') return
    const timer = setTimeout(() => setStatus(null), 3500)
    return () => clearTimeout(timer)
  }, [status])
  const title = status ? t(`shared.network_${status}`) : ''
  const description = status === 'offline' ? t('shared.network_offline_description') : ''
  const message = description ? `${title}. ${description}` : title
  useEffect(() => {
    if (!status) return
    if (reduceMotion) { offset.setValue(0); return }
    offset.setValue(-3)
    const animation = Animated.timing(offset, { toValue: 0, duration: 180, useNativeDriver: true })
    animation.start()
    return () => animation.stop()
  }, [status, reduceMotion, offset])
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message)
  }, [message])
  if (!status) return null
  const offline = status === 'offline'
  const color = offline ? palette.soonText : palette.freshText
  const Icon = offline ? WifiOffIcon : CircleCheckIcon
  return (
    <SafeAreaView edges={['top', 'left', 'right']}
      style={{ backgroundColor: offline ? palette.soonBg : palette.freshBg }}>
      <Animated.View style={{ transform: [{ translateY: offset }] }}>
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
      </Animated.View>
    </SafeAreaView>
  )
}
