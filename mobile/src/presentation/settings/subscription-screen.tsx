import { useTranslation } from '../../i18n/index.js'
/**
 * Réglages > Abonnement (ADR 0014). Three states off `access.plan`:
 * self-hosted → not applicable (nothing to buy, AI is unlimited on your own
 * server); free → the paywall; subscriber → what is active and until when.
 * iOS reuses the subscription cards, with a single action opening the web
 * subscription page instead of direct billing.
 */
import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { BadgeCheckIcon } from '../dashboard/dashboard-icons.js'
import { SkeletonCard, SkeletonGroup } from '../shared/skeleton.js'
import { AiQuotaHint, SubscriptionActiveCard, SubscriptionPaywall } from './ai-access-cards.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'

export function SubscriptionScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const settings = useAiSettingsQuery()
  const refresh = usePullToRefresh(() => settings.refetch())
  const subscription = useAiSubscribe()
  const access = settings.data?.access

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      refresh={refresh}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <BadgeCheckIcon size={19} color={color} />}
          title={t('settings.subscription')}
          onBack={() => router.back()}
        />
      }
    >
      <YStack gap="$3" marginTop="$5">
        {settings.isPending ? (
          <SkeletonGroup label={t('settings.loading_subscription')}>
            <SkeletonCard height={56} palette={palette} />
            <SkeletonCard height={320} palette={palette} />
          </SkeletonGroup>
        ) : null}

        {access?.plan === 'self-hosted' ? (
          <YStack testID="subscription-not-applicable" gap="$1.5" padding="$4" borderRadius="$4" backgroundColor={palette.cream}>
            <Text fontSize={16} fontWeight="800" color={palette.ink}>{t('settings.not_applicable')}</Text>
            <Text fontSize={13} color={palette.inkSecondary}>{t('settings.you_re_using_a_self_hosted_server_ai_is_unlimited')}</Text>
          </YStack>
        ) : null}

        {/* Free plan: the usage comes first — the paywall answers it, it does not open the screen. */}
        {access?.plan === 'free' ? <AiQuotaHint access={access} palette={palette} showCta={false} /> : null}

        {access?.plan === 'free' ? (
          <SubscriptionPaywall
            palette={palette}
            onSubscribe={subscription.subscribe}
            webOnly={!subscription.billing}
            pending={subscription.pending}
            error={subscription.error}
          />
        ) : null}

        {access?.plan === 'subscriber' ? (
          <SubscriptionActiveCard
            palette={palette}
            until={access.expiresAt}
            cancelled={access.cancelsAtPeriodEnd}
            onManage={subscription.manage}
            webOnly={!subscription.billing}
            pending={subscription.pending}
            error={subscription.error}
          />
        ) : null}

        {access && access.plan !== 'free' ? <AiQuotaHint access={access} palette={palette} showCta={false} /> : null}

        {!settings.isPending && !settings.data ? (
          <YStack gap="$1.5" accessibilityLiveRegion="polite">
            <Text fontSize={13} color={palette.expiredText}>{t('settings.couldn_t_load_subscription')}</Text>
            <Pressable testID="subscription-retry" onPress={() => void settings.refetch()} accessibilityRole="button" hitSlop={8}>
              <Text fontSize={13} fontWeight="700" color={palette.lavenderText}>{t('dashboard.try_again')}</Text>
            </Pressable>
          </YStack>
        ) : null}
      </YStack>
    </AppShell>
  )
}
