/**
 * Réglages > Abonnement (ADR 0014). Three states off `access.plan`:
 * self-hosted → not applicable (nothing to buy, AI is unlimited on your own
 * server); free → the paywall; subscriber → what is active and until when.
 * Without billing (iOS, ADR 0019) there is no in-app paywall or portal, only
 * the quota and a link to manage the subscription on the web (App Store rule
 * 3.1.3(b)). Réglages hides the entry; this guards a stray deep link.
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
import { AiQuotaHint, ExternalSubscriptionNotice, SubscriptionActiveCard, SubscriptionPaywall } from './ai-access-cards.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'

export function SubscriptionScreen() {
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
          title={subscription.billing ? 'Abonnement' : 'Quota IA'}
          onBack={() => router.back()}
        />
      }
    >
      <YStack gap="$3" marginTop="$5">
        {settings.isPending ? (
          <SkeletonGroup label="Chargement de l’abonnement">
            <SkeletonCard height={56} palette={palette} />
            <SkeletonCard height={320} palette={palette} />
          </SkeletonGroup>
        ) : null}

        {access?.plan === 'self-hosted' ? (
          <YStack testID="subscription-not-applicable" gap="$1.5" padding="$4" borderRadius="$4" backgroundColor={palette.cream}>
            <Text fontSize={16} fontWeight="800" color={palette.ink}>
              Non applicable
            </Text>
            <Text fontSize={13} color={palette.inkSecondary}>
              Tu utilises un serveur auto-hébergé : l’IA n’y est pas limitée et aucun abonnement n’est nécessaire.
            </Text>
          </YStack>
        ) : null}

        {/* Free plan: the usage comes first — the paywall answers it, it does not open the screen. */}
        {access?.plan === 'free' ? <AiQuotaHint access={access} palette={palette} showCta={false} /> : null}

        {access?.plan === 'free' && subscription.billing ? (
          <SubscriptionPaywall
            palette={palette}
            onSubscribe={subscription.subscribe}
            pending={subscription.pending}
            error={subscription.error}
          />
        ) : null}

        {access?.plan === 'free' && !subscription.billing ? <ExternalSubscriptionNotice palette={palette} /> : null}

        {access?.plan === 'subscriber' && subscription.billing ? (
          <SubscriptionActiveCard
            palette={palette}
            until={access.expiresAt}
            cancelled={access.cancelsAtPeriodEnd}
            onManage={subscription.manage}
            pending={subscription.pending}
            error={subscription.error}
          />
        ) : null}

        {access?.plan === 'subscriber' && !subscription.billing ? <ExternalSubscriptionNotice palette={palette} /> : null}

        {access && access.plan !== 'free' ? <AiQuotaHint access={access} palette={palette} showCta={false} /> : null}

        {!settings.isPending && !settings.data ? (
          <YStack gap="$1.5" accessibilityLiveRegion="polite">
            <Text fontSize={13} color={palette.expiredText}>
              Impossible de charger l’abonnement.
            </Text>
            <Pressable testID="subscription-retry" onPress={() => void settings.refetch()} accessibilityRole="button" hitSlop={8}>
              <Text fontSize={13} fontWeight="700" color={palette.lavenderText}>
                Réessayer
              </Text>
            </Pressable>
          </YStack>
        ) : null}
      </YStack>
    </AppShell>
  )
}
