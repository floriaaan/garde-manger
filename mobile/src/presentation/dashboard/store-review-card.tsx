import { useRef, useState } from 'react'
import { Linking, Platform } from 'react-native'
import appConfig from '../../../app.json'
import { useTranslation } from '../../i18n/index.js'
import { PillButton } from '../shared/pill-button.js'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { StarIcon } from './dashboard-icons.js'
import type { SoftPalette } from './soft-palette.js'

export function StoreReviewCard({ palette }: { palette: SoftPalette }) {
  const { t } = useTranslation()
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null

  async function requestReview() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setFailed(false)
    try {
      try {
        // Load on tap so an older native client without the module can still
        // open its store listing. The chosen backend has no bearing on this.
        const StoreReview = await import('expo-store-review')
        if (await StoreReview.isAvailableAsync()) {
          await StoreReview.requestReview()
          // The OS can silently suppress the prompt; it exposes no result.
          return
        }
      } catch {
        // An unavailable module or failed native request falls back to the store.
      }
      const url = Platform.OS === 'ios'
        ? `${appConfig.expo.ios.appStoreUrl}?action=write-review`
        : `${appConfig.expo.android.playStoreUrl}&showAllReviews=true`
      await Linking.openURL(url)
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <YStack testID="dashboard-store-review-card" marginTop="$6" padding="$4" gap="$2" backgroundColor={palette.cream} borderRadius={18}>
      <Text fontSize={15} fontWeight="800" color={palette.ink}>{t('dashboard.review_title')}</Text>
      <Text fontSize={14} fontWeight="500" color={palette.creamText}>{t('dashboard.review_description')}</Text>
      <PillButton
        testID="dashboard-store-review"
        label={t('dashboard.review_action')}
        onPress={() => void requestReview()}
        disabled={pending}
        icon={(color) => <StarIcon size={16} color={color} />}
        palette={palette}
      />
      {failed ? (
        <Text accessibilityRole="alert" fontSize={13} fontWeight="500" color={palette.expiredText}>{t('dashboard.review_unavailable')}</Text>
      ) : null}
    </YStack>
  )
}
