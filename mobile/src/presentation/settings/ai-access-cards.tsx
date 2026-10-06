import { t, useTranslation, getLocale } from '../../i18n/index.js'
/**
 * The three things the AI provider screen can show instead of a picker,
 * depending on `AiSettings.access.plan` and `canChooseProvider`:
 * - self-hosted, no provider configured → point at the setup guide.
 * - hosted, not subscribed → suggest the subscription.
 * - anyone with a capped quota → say how much is left.
 */
import type { ReactNode } from 'react'
import { Image, Linking, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { BadgeCheckIcon, CircleCheckIcon, SparklesIcon } from '../dashboard/dashboard-icons.js'
import { HeroWarmGlow } from '../dashboard/hero-warm-glow.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'
import { platformCapabilities } from '../../application/shared/platform-capabilities.js'
import { hexToRgba } from '../shared/hex-to-rgba.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import type { AiAccess } from '../../domain/settings/ai-settings.js'

const TERMS_OF_SALE_URL = 'https://gardemanger.floriaaan.fr/cgv#retractation'
const SETUP_GUIDE_URL = 'https://github.com/floriaaan/garde-manger/blob/main/README.fr.md#ia-scan-de-tickets-recettes'

const WEB_SUBSCRIPTION_NOTICE = () => t('settings.manage_your_subscription_on_the_web_sign_in_with_the')

export function AiSetupGuideCard({ palette }: { palette: SoftPalette }) {
  const { t } = useTranslation()
  return (
    <YStack gap="$1.5" padding="$3" borderRadius="$4" backgroundColor={palette.cream}>
      <Text fontSize={14} fontWeight="700" color={palette.ink}>{t('settings.no_ai_provider_configured')}</Text>
      <Text fontSize={13} color={palette.inkSecondary}>{t('settings.receipt_scanning_and_recipes_need_an_api_key_gemini_openai')}</Text>
      <Pressable onPress={() => Linking.openURL(SETUP_GUIDE_URL)} testID="ai-setup-guide-link">
        <Text fontSize={13} fontWeight="700" color={palette.lavenderText}>{t('settings.view_setup_guide')}</Text>
      </Pressable>
    </YStack>
  )
}

const mascotGold = require('../../../assets/mascot-gold.png')

const PAYWALL_BENEFITS = () => [t('settings.receipt_and_fridge_scanning'), t('settings.unlimited_generated_recipes'), t('settings.shared_with_the_entire_household')]

const MASCOT_GUTTER = 96

/** The screen's one dark surface — same `brandDeep` + ember glow as the hero card; the paywall and the active-plan card both wear it (never together). */
function DarkSurface({ testID, palette, children }: { testID: string; palette: SoftPalette; children: ReactNode }) {
  return (
    <YStack
      testID={testID}
      overflow="hidden"
      backgroundColor={palette.brandDeep}
      style={{
        // Anchor the absolute mascot and glow to this card on web too.
        position: 'relative',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 36,
        borderBottomLeftRadius: 20,
        shadowColor: palette.shadowCool,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 6,
      }}
    >
      <HeroWarmGlow warm={palette.accentWarm} ground={palette.brandDeep} />
      {/* The gold mascot: the same character, in the tier's colour. Headers reserve `MASCOT_GUTTER` so titles wrap beside it. */}
      <Image
        source={mascotGold}
        resizeMode="contain"
        accessibilityLabel=""
        style={{ position: 'absolute', top: 10, right: 10, width: 108, height: 108 }}
      />
      {children}
    </YStack>
  )
}

/**
 * What a subscriber sees instead of the paywall: the same dark surface, the
 * status as the headline, and what is unlocked (the paywall's own benefit
 * list, now in the present tense). `onManage` is the one action.
 */
export function SubscriptionActiveCard({
  palette,
  until,
  cancelled,
  onManage,
  webOnly = false,
  pending,
  error,
}: {
  palette: SoftPalette
  until?: string | null
  /** Cancelled in Stripe: access holds until `until`, no renewal. */
  cancelled?: boolean
  onManage: () => void
  /** iOS: the only billing action opens the web subscription page. */
  webOnly?: boolean
  pending?: boolean
  error?: string | null
}) {
  const { t } = useTranslation()
  return (
    <DarkSurface testID="subscription-active" palette={palette}>
      <YStack padding="$5" gap="$4">
        <YStack gap="$2" paddingRight={MASCOT_GUTTER}>
          <XStack
            alignSelf="flex-start"
            alignItems="center"
            gap="$1.5"
            paddingHorizontal="$2.5"
            paddingVertical="$1.5"
            borderRadius={999}
            backgroundColor={palette.heroPillFill}
          >
            <BadgeCheckIcon size={14} color={palette.onDark} />
            <Text fontSize={12} fontWeight="700" color={palette.onDark}>
              {cancelled ? t('settings.cancelled') : until ? t('settings.renews_on', { value1: new Date(until).toLocaleDateString(getLocale()) }) : t('job.in_progress')}
            </Text>
          </XStack>
          <Text fontSize={36} fontWeight="900" lineHeight={38} letterSpacing={-1} color={palette.onDark}>
            {cancelled ? t('settings.cancelled') : t('dashboard.subscription_active')}
          </Text>
          <Text fontSize={14} fontWeight="600" color={palette.onDarkSecondary}>
            {cancelled && until
              ? t('settings.ai_stays_unlocked_until_then_returns_to_the_free_plan', { value1: new Date(until).toLocaleDateString(getLocale()) })
              : t('settings.ai_is_unlocked_for_the_entire_household')}
          </Text>
        </YStack>

        <YStack height={0} borderTopWidth={1.5} borderStyle="dashed" borderColor={palette.onDarkSecondary} opacity={0.4} />

        <YStack gap="$2">
          {PAYWALL_BENEFITS().map((benefit) => (
            <XStack key={benefit} alignItems="center" gap="$2.5">
              <CircleCheckIcon size={18} color={palette.accentLime} />
              <Text flex={1} fontSize={14} fontWeight="600" color={palette.onDark}>
                {benefit}
              </Text>
            </XStack>
          ))}
        </YStack>

        <Text fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>{t('settings.only_the_subscriber_can_change_or_cancel_the_subscription')}</Text>
        <Pressable
          onPress={onManage}
          disabled={pending}
          testID={webOnly ? 'subscription-web-link' : 'subscription-manage'}
          accessibilityRole="button"
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          <XStack backgroundColor={palette.cream} borderRadius={999} alignItems="center" justifyContent="center" minHeight={52}>
            <Text fontSize={16} fontWeight="900" color={palette.ink}>
              {pending ? t('settings.one_moment') : webOnly ? t('settings.manage_subscription_on_the_web') : cancelled ? t('settings.resume_subscription') : t('settings.manage_subscription')}
            </Text>
          </XStack>
        </Pressable>
        {webOnly ? <Text fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>{WEB_SUBSCRIPTION_NOTICE()}</Text> : null}
        {error ? (
          <Text fontSize={12} fontWeight="600" color={palette.onDarkSecondary} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </YStack>
    </DarkSurface>
  )
}

/**
 * The one paywall — Réglages, the recipe sheet and both scan screens all
 * render this. It is the screen's one dark surface (same `brandDeep` + ember
 * glow as the hero card), so it asks for money without a second visual
 * language: the price is the headline, cut off from the benefits by a
 * dashed tear line like the receipt the app scans. `reason` says why it
 * showed up (quota spent) instead of a bare pitch.
 */
export function SubscriptionPaywall({
  palette,
  onSubscribe,
  webOnly = false,
  pending,
  reason,
  error,
}: {
  palette: SoftPalette
  onSubscribe: () => void
  /** Reuse the offer card with only a web redirect, without direct billing copy. */
  webOnly?: boolean
  pending?: boolean
  reason?: string
  error?: string | null
}) {
  const { t } = useTranslation()
  return (
    <DarkSurface testID="subscription-paywall" palette={palette}>
      <YStack padding="$5" gap="$4">
        <YStack gap="$2" paddingRight={MASCOT_GUTTER}>
          {reason ? (
            <XStack
              alignSelf="flex-start"
              alignItems="center"
              gap="$1.5"
              paddingHorizontal="$2.5"
              paddingVertical="$1.5"
              borderRadius={999}
              backgroundColor={palette.heroPillFill}
            >
              <SparklesIcon size={14} color={palette.onDark} />
              <Text fontSize={12} fontWeight="700" color={palette.onDark}>
                {reason}
              </Text>
            </XStack>
          ) : null}
          <Text fontSize={28} fontWeight="900" lineHeight={32} letterSpacing={-0.5} color={palette.onDark}>{t('settings.garde_manger_subscription')}</Text>
        </YStack>

        {!webOnly ? (
          <XStack alignItems="flex-end" gap="$2.5">
            <Text fontSize={64} fontWeight="900" lineHeight={64} letterSpacing={-2} color={palette.onDark}>
              0,99€
            </Text>
            <Text flex={1} fontSize={14} fontWeight="700" lineHeight={18} color={palette.onDarkSecondary} paddingBottom={6}>{t('settings.per_month_for_the_entire_household', { value1: '\n' })}</Text>
          </XStack>
        ) : null}

        <YStack height={0} borderTopWidth={1.5} borderStyle="dashed" borderColor={palette.onDarkSecondary} opacity={0.4} />

        <YStack gap="$2">
          {PAYWALL_BENEFITS().map((benefit) => (
            <XStack key={benefit} alignItems="center" gap="$2.5">
              <CircleCheckIcon size={18} color={palette.onDarkSecondary} />
              <Text flex={1} fontSize={14} fontWeight="600" color={palette.onDark}>
                {benefit}
              </Text>
            </XStack>
          ))}
        </YStack>

        <Pressable
          onPress={onSubscribe}
          disabled={pending}
          testID={webOnly ? 'subscription-web-link' : 'subscription-paywall-cta'}
          accessibilityRole="button"
          accessibilityLabel={webOnly ? t('settings.subscribe_on_the_web') : t('settings.subscribe_for_0_99_per_month')}
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          <XStack
            backgroundColor={palette.accentLime}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            gap="$2"
            minHeight={52}
          >
            <SparklesIcon size={18} color={palette.accentLimeText} />
            <Text fontSize={16} fontWeight="900" color={palette.accentLimeText}>
              {pending ? t('settings.one_moment') : webOnly ? t('settings.subscribe_on_the_web') : t('settings.subscribe')}
            </Text>
          </XStack>
        </Pressable>
        {error ? (
          <Text fontSize={12} fontWeight="600" color={palette.onDarkSecondary} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {webOnly ? (
          <Text fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>{WEB_SUBSCRIPTION_NOTICE()}</Text>
        ) : (
          <>
            <Text fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>{t('settings.secure_payment_by_stripe_cancel_anytime_from_the_app')}</Text>
            <Text testID="subscription-withdrawal-notice" fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>
              {t('settings.by_subscribing_you_request_immediate_access_to_the_service_and')}{' '}
              <Text
                fontSize={12}
                fontWeight="700"
                color={palette.onDark}
                textDecorationLine="underline"
                accessibilityRole="link"
                onPress={() => Linking.openURL(TERMS_OF_SALE_URL)}
              >{t('settings.view_terms_of_sale')}</Text>
            </Text>
          </>
        )}
      </YStack>
    </DarkSurface>
  )
}

/** Paywall wired to the purchase flow — drop it wherever an AI call just hit the free quota. Renders nothing off the free plan. */
export function ConnectedPaywall({ palette, reason }: { palette: SoftPalette; reason?: string }) {
  const { canSubscribe, subscribe, pending, error } = useAiSubscribe()
  if (!canSubscribe) return null
  return <SubscriptionPaywall palette={palette} onSubscribe={subscribe} pending={pending} reason={reason} error={error} />
}

/** Share of the free quota from which the hint starts pointing at the subscription. */
export const NUDGE_RATIO = 0.6

export function AiQuotaHint({ access, palette, showCta = true }: { access: AiAccess; palette: SoftPalette; showCta?: boolean }) {
  const { t } = useTranslation()
  if (access.limit === null) return null
  const ratio = Math.min(access.used / access.limit, 1)
  // Without billing (iOS) the plan is never named: a free tier implies a paid one.
  const label = !platformCapabilities.billing ? t('settings.household_ai') : access.plan === 'free' ? t('settings.free_plan') : t('settings.subscription')
  const spent = ratio >= 1
  return (
    <YStack testID="ai-quota-hint" gap="$1.5" marginTop="$2">
      <XStack justifyContent="space-between">
        <Text fontSize={12} fontWeight="700" color={palette.ink}>
          {label}
        </Text>
        <Text fontSize={12} fontWeight="600" color={spent ? palette.expiredText : palette.inkSecondary}>{t('settings.ai_calls_this_month', { value1: spent ? t('settings.quota_reached') : '', value2: access.used, value3: access.limit })}</Text>
      </XStack>
      {/* Its own track (an empty 0/N bar drew nothing on `gradientBottom`), tinted
          from `ink` so it holds on every pastel surface in both themes; the fill
          is `mintPaleText`, the one teal dark enough to clear 3:1 against it. */}
      <YStack
        height={8}
        borderRadius={4}
        overflow="hidden"
        role="progressbar"
        accessibilityValue={{ min: 0, max: access.limit, now: access.used }}
        backgroundColor={hexToRgba(palette.ink, 0.22)}>
        <YStack
          testID="ai-quota-bar"
          height={8}
          borderRadius={4}
          width={`${Math.round(ratio * 100)}%`}
          backgroundColor={spent ? palette.expiredText : palette.mintPaleText}
        />
      </YStack>
      {showCta && platformCapabilities.billing && ratio >= NUDGE_RATIO && access.plan === 'free' ? (
        <Pressable
          testID="ai-quota-subscribe"
          onPress={() => router.push('/subscription')}
          accessibilityRole="link"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Text fontSize={13} fontWeight="700" color={palette.lavenderText} textDecorationLine="underline">
            {spent ? t('settings.subscribe_to_continue') : t('settings.more_calls_with_a_subscription')}
          </Text>
        </Pressable>
      ) : null}
    </YStack>
  )
}
