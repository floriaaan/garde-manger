import { useState } from 'react'
import { Image, Linking, Platform, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from '../../i18n/index.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { PillButton } from '../shared/pill-button.js'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { MessageSquareIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { NotificationFeedback } from './notification-feedback.js'

const FEEDBACK_EMAIL = 'garde-manger@floriaaan.fr'

export function FeedbackScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const { height, fontScale } = useWindowDimensions()
  const illustrationSize = height / fontScale < 700 ? 96 : 128
  const [status, setStatus] = useState<'idle' | 'opening' | 'opened' | 'failed'>('idle')

  async function openEmail() {
    setStatus('opening')
    try {
      // Only translated prompts leave the app: no account, server or inventory data.
      const result = await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(t('feedback.subject'))}&body=${encodeURIComponent(t('feedback.template'))}`)
      setStatus(result === false ? 'failed' : 'opened')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <AppShell nav={{ kind: 'stack' }} header={
      <ScreenHeader palette={palette} title={t('feedback.title')}
        icon={(color) => <MessageSquareIcon size={19} color={color} />}
        onBack={() => router.back()} />
    }>
      <YStack marginTop="$5" gap="$5">
        <YStack backgroundColor={palette.cream} padding="$5" gap="$4"
          style={{ borderTopLeftRadius: 30, borderTopRightRadius: 16, borderBottomRightRadius: 30, borderBottomLeftRadius: 16,
            shadowColor: palette.shadowWarm, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 }}>
          <Image source={require('../../../assets/illustrations/feedback-envelope-3d.png')}
            resizeMode="contain" accessible={false} accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: illustrationSize, height: illustrationSize, alignSelf: 'center' }} />
          <YStack gap="$3">
            <Text role="heading" style={Platform.OS === 'web' ? { fontFamily: '"Spectral", Georgia, serif' } : undefined}
              fontSize={32} lineHeight={40} fontWeight={Platform.OS === 'web' ? '600' : '800'} color={palette.ink}>
              {t('feedback.intro')}
            </Text>
            <Text fontSize={14} color={palette.creamText}>{t('feedback.examples')}</Text>
          </YStack>
          <YStack gap="$3">
            <Text fontSize={12} color={palette.creamText}>{t('feedback.privacy')}</Text>
            <PillButton fullWidth testID="feedback-open-email" label={t(status === 'failed' ? 'feedback.retry' : status === 'opening' ? 'feedback.opening' : 'feedback.open_email')}
              palette={palette} disabled={status === 'opening'} busy={status === 'opening'}
              onPress={() => { void openEmail() }} />
            <Text fontSize={12} color={palette.creamText}>{t('feedback.email_guidance')}</Text>
          </YStack>
        </YStack>

        <NotificationFeedback palette={palette} error={status === 'failed'} message={
          status === 'failed' ? t('feedback.failed') : status === 'opened' ? t('feedback.opened') : null
        } />

        <YStack paddingHorizontal="$1" gap="$1">
          <Text fontSize={13} color={palette.inkSecondary}>{t('feedback.alternative')}</Text>
          <Text testID="feedback-email-address" selectable={Platform.OS !== 'web' ? true : undefined}
            style={Platform.OS === 'web' ? { userSelect: 'text' } : undefined}
            fontSize={14} fontWeight="600" color={palette.ink}>
            {FEEDBACK_EMAIL}
          </Text>
        </YStack>
      </YStack>
    </AppShell>
  )
}
