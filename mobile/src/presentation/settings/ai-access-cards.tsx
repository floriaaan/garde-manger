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
import { hexToRgba } from '../shared/hex-to-rgba.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import type { AiAccess } from '../../domain/settings/ai-settings.js'

const TERMS_OF_SALE_URL = 'https://gardemanger.floriaaan.fr/cgv#retractation'
const SETUP_GUIDE_URL = 'https://github.com/floriaaan/fridge-ai/blob/main/README.fr.md#ia-scan-de-tickets-recettes'

export function AiSetupGuideCard({ palette }: { palette: SoftPalette }) {
  return (
    <YStack gap="$1.5" padding="$3" borderRadius="$4" backgroundColor={palette.cream}>
      <Text fontSize={14} fontWeight="700" color={palette.ink}>
        Aucun fournisseur IA configuré
      </Text>
      <Text fontSize={13} color={palette.inkSecondary}>
        Le scan de tickets et les recettes ont besoin d’une clé (Gemini, OpenAI) ou d’un modèle Ollama local sur ce
        serveur.
      </Text>
      <Pressable onPress={() => Linking.openURL(SETUP_GUIDE_URL)} testID="ai-setup-guide-link">
        <Text fontSize={13} fontWeight="700" color={palette.lavenderText}>
          Voir le guide de configuration
        </Text>
      </Pressable>
    </YStack>
  )
}

const mascotGold = require('../../../assets/mascot-gold.png')

const PAYWALL_BENEFITS = ['Scan de tickets et de frigo', 'Recettes générées à volonté', 'Partagé avec tout le foyer']

const MASCOT_GUTTER = 96

/** The screen's one dark surface — same `brandDeep` + ember glow as the hero card; the paywall and the active-plan card both wear it (never together). */
function DarkSurface({ testID, palette, children }: { testID: string; palette: SoftPalette; children: ReactNode }) {
  return (
    <YStack
      testID={testID}
      overflow="hidden"
      backgroundColor={palette.brandDeep}
      style={{
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
  pending,
  error,
}: {
  palette: SoftPalette
  until?: string | null
  /** Cancelled in Stripe: access holds until `until`, no renewal. */
  cancelled?: boolean
  onManage: () => void
  pending?: boolean
  error?: string | null
}) {
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
              {cancelled ? 'Résilié' : until ? `Renouvelé le ${new Date(until).toLocaleDateString('fr-FR')}` : 'En cours'}
            </Text>
          </XStack>
          <Text fontSize={36} fontWeight="900" lineHeight={38} letterSpacing={-1} color={palette.onDark}>
            {cancelled ? 'Résilié' : 'Abonnement actif'}
          </Text>
          <Text fontSize={14} fontWeight="600" color={palette.onDarkSecondary}>
            {cancelled && until
              ? `L’IA reste débloquée jusqu’au ${new Date(until).toLocaleDateString('fr-FR')}, puis repasse à l’offre gratuite.`
              : 'L’IA est débloquée pour tout le foyer.'}
          </Text>
        </YStack>

        <YStack height={0} borderTopWidth={1.5} borderStyle="dashed" borderColor={palette.onDarkSecondary} opacity={0.4} />

        <YStack gap="$2">
          {PAYWALL_BENEFITS.map((benefit) => (
            <XStack key={benefit} alignItems="center" gap="$2.5">
              <CircleCheckIcon size={18} color={palette.accentLime} />
              <Text flex={1} fontSize={14} fontWeight="600" color={palette.onDark}>
                {benefit}
              </Text>
            </XStack>
          ))}
        </YStack>

        <Text fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>
          Seule la personne qui a souscrit peut modifier ou résilier l’abonnement.
        </Text>
        <Pressable
          onPress={onManage}
          disabled={pending}
          testID="subscription-manage"
          accessibilityRole="button"
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          <XStack backgroundColor={palette.cream} borderRadius={999} alignItems="center" justifyContent="center" minHeight={52}>
            <Text fontSize={16} fontWeight="900" color={palette.ink}>
              {pending ? 'Un instant…' : cancelled ? 'Reprendre l’abonnement' : 'Gérer l’abonnement'}
            </Text>
          </XStack>
        </Pressable>
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
  pending,
  reason,
  error,
}: {
  palette: SoftPalette
  onSubscribe: () => void
  pending?: boolean
  reason?: string
  error?: string | null
}) {
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
          <Text fontSize={28} fontWeight="900" lineHeight={32} letterSpacing={-0.5} color={palette.onDark}>
            Abonnement Garde-manger
          </Text>
        </YStack>

        <XStack alignItems="flex-end" gap="$2.5">
          <Text fontSize={64} fontWeight="900" lineHeight={64} letterSpacing={-2} color={palette.onDark}>
            0,99€
          </Text>
          <Text flex={1} fontSize={14} fontWeight="700" lineHeight={18} color={palette.onDarkSecondary} paddingBottom={6}>
            par mois,{'\n'}pour tout le foyer
          </Text>
        </XStack>

        <YStack height={0} borderTopWidth={1.5} borderStyle="dashed" borderColor={palette.onDarkSecondary} opacity={0.4} />

        <YStack gap="$2">
          {PAYWALL_BENEFITS.map((benefit) => (
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
          testID="subscription-paywall-cta"
          accessibilityRole="button"
          accessibilityLabel="S’abonner pour 0,99 euro par mois"
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
              {pending ? 'Un instant…' : 'S’abonner'}
            </Text>
          </XStack>
        </Pressable>
        {error ? (
          <Text fontSize={12} fontWeight="600" color={palette.onDarkSecondary} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Text fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>
          Paiement sécurisé par Stripe. Résiliable à tout moment depuis l’application.
        </Text>
        <Text testID="subscription-withdrawal-notice" fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>
          En t’abonnant, tu demandes l’accès immédiat au service et tu renonces à ton droit de rétractation une fois le
          service pleinement exécuté.{' '}
          <Text
            fontSize={12}
            fontWeight="700"
            color={palette.onDark}
            textDecorationLine="underline"
            accessibilityRole="link"
            onPress={() => Linking.openURL(TERMS_OF_SALE_URL)}
          >
            Voir les CGV
          </Text>
        </Text>
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
  if (access.limit === null) return null
  const ratio = Math.min(access.used / access.limit, 1)
  const label = access.plan === 'free' ? 'Offre gratuite' : 'Abonnement'
  const spent = ratio >= 1
  return (
    <YStack testID="ai-quota-hint" gap="$1.5" marginTop="$2">
      <XStack justifyContent="space-between">
        <Text fontSize={12} fontWeight="700" color={palette.ink}>
          {label}
        </Text>
        <Text fontSize={12} fontWeight="600" color={spent ? palette.expiredText : palette.inkSecondary}>
          {spent ? 'Quota atteint · ' : ''}
          {access.used}/{access.limit} appels IA ce mois-ci
        </Text>
      </XStack>
      {/* Its own track (an empty 0/N bar drew nothing on `gradientBottom`), tinted
          from `ink` so it holds on every pastel surface in both themes; the fill
          is `mintPaleText`, the one teal dark enough to clear 3:1 against it. */}
      <YStack
        height={8}
        borderRadius={4}
        overflow="hidden"
        accessibilityRole="progressbar"
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
      {showCta && ratio >= NUDGE_RATIO && access.plan === 'free' ? (
        <Pressable
          testID="ai-quota-subscribe"
          onPress={() => router.push('/subscription')}
          accessibilityRole="link"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Text fontSize={13} fontWeight="700" color={palette.lavenderText} textDecorationLine="underline">
            {spent ? 'S’abonner pour continuer' : 'Plus d’appels avec l’abonnement'}
          </Text>
        </Pressable>
      ) : null}
    </YStack>
  )
}
