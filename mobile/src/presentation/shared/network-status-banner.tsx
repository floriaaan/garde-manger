import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useConnectivity } from '../../application/shared/use-connectivity.js'
import { useTranslation } from '../../i18n/index.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { Text, XStack } from './tamagui-typed.js'

/** Reserve space instead of covering navigation or blocking touches with an overlay. */
export function NetworkStatusBanner() {
  const online = useConnectivity()
  const { t } = useTranslation()
  const palette = useSoftPalette()
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
  const message = status ? t(`shared.network_${status}`) : ''
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message)
  }, [message])
  if (!status) return null
  const offline = status === 'offline'
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: offline ? palette.soonBg : palette.freshBg }}>
      <XStack testID="network-status-banner" paddingHorizontal={16} paddingVertical={10}
        alignSelf="center" width="100%" maxWidth={480}>
        <Text role="status" accessibilityLiveRegion="polite" fontSize={14} fontWeight="600"
          textAlign="center" flexShrink={1} color={offline ? palette.soonText : palette.freshText}>
          {message}
        </Text>
      </XStack>
    </SafeAreaView>
  )
}
