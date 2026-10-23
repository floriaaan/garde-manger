import { useState } from 'react'
import { Linking } from 'react-native'
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
  const [status, setStatus] = useState<'idle' | 'opening' | 'opened' | 'failed'>('idle')

  async function openEmail() {
    setStatus('opening')
    try {
      // Only a translated invitation leaves the app: no account, server or inventory data.
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
        <YStack gap="$2">
          <Text fontSize={18} fontWeight="600" color={palette.ink}>{t('feedback.intro')}</Text>
          <Text fontSize={14} color={palette.inkSecondary}>{t('feedback.examples')}</Text>
        </YStack>

        <YStack gap="$3">
          <YStack gap="$2">
            <Text fontSize={13} color={palette.inkSecondary}>{t('feedback.privacy')}</Text>
            <Text fontSize={13} color={palette.inkSecondary}>{t('feedback.email_guidance')}</Text>
          </YStack>
          <PillButton testID="feedback-open-email" label={t(status === 'failed' ? 'feedback.retry' : status === 'opening' ? 'feedback.opening' : 'feedback.open_email')}
            palette={palette} disabled={status === 'opening'} busy={status === 'opening'}
            onPress={() => { void openEmail() }} />
          <NotificationFeedback palette={palette} error={status === 'failed'} message={
            status === 'failed' ? t('feedback.failed') : status === 'opened' ? t('feedback.opened') : null
          } />
        </YStack>

        <YStack marginTop="$2" gap="$1">
          <Text fontSize={13} color={palette.inkSecondary}>{t('feedback.alternative')}</Text>
          <Text testID="feedback-email-address" selectable fontSize={14} fontWeight="600" color={palette.ink}>
            {FEEDBACK_EMAIL}
          </Text>
        </YStack>
      </YStack>
    </AppShell>
  )
}
