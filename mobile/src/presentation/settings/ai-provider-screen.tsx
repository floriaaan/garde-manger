import { t, useTranslation } from '../../i18n/index.js'
/**
 * Réglages > Intelligence artificielle > provider picker — its own page
 * (2026-09-18) rather than a footer inline on the Réglages card: the model
 * names (`settings-ai-models`) and the provider chips are the kind of
 * technical detail Réglages itself stopped showing (cf. Serveur card).
 *
 * `canChooseProvider` (2026-09-18, ADR 0014) replaces the picker with a
 * subscription/quota card on the hosted instance: the operator fixes the
 * provider there, nothing for the foyer to choose.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { RadioCard } from '../shared/radio-card.js'
import { useSoftPalette, type SoftPalette } from '../dashboard/soft-palette.js'
import { CameraIcon, ChefHatIcon, ReceiptIcon, SparklesIcon } from '../dashboard/dashboard-icons.js'
import { GeminiIcon } from './gemini-icon.js'
import { OpenAiIcon } from './openai-icon.js'
import { OllamaIcon } from './ollama-icon.js'
import { AiQuotaHint, AiSetupGuideCard } from './ai-access-cards.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useSetActiveAiProviderMutation } from '../../application/settings/set-active-ai-provider.mutation.js'
import { platformCapabilities } from '../../application/shared/platform-capabilities.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

const PROVIDER_LABELS: Record<AiProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama' }

const PROVIDER_TINTS: Record<AiProvider, string> = { gemini: '#4C8DF6', openai: '#10A37F', ollama: '#1A1A1A' }

const PROVIDER_DESCRIPTIONS: Record<AiProvider, string> = {
  get gemini() { return t('settings.google_s_model_sent_to_their_servers') },
  get openai() { return t('settings.openai_s_model_sent_to_their_servers') },
  get ollama() { return t('settings.a_model_running_on_your_own_server_nothing_leaves_it') },
}

const AI_FEATURES = [
  { get title() { return t('settings.receipt_scanning') }, get description() { return t('settings.photograph_your_receipt_products_appear_in_the_fridge_with_their') }, chip: (p: SoftPalette) => p.chipTeal, Icon: ReceiptIcon },
  { get title() { return t('settings.fridge_scanning') }, get description() { return t('settings.photograph_your_fridge_to_identify_everything_inside_at_once') }, chip: (p: SoftPalette) => p.chipViolet, Icon: CameraIcon },
  { get title() { return t('dashboard.recipes') }, get description() { return t('settings.meal_ideas_using_what_will_expire_soon') }, chip: (p: SoftPalette) => p.chipOrange, Icon: ChefHatIcon },
] as const

function ProviderIcon({ provider, color }: { provider: AiProvider; color: string }) {
  switch (provider) {
    case 'gemini':
      return <GeminiIcon size={17} color={color} />
    case 'openai':
      return <OpenAiIcon size={17} color={color} />
    case 'ollama':
      return <OllamaIcon size={17} />
  }
}

export function AiProviderScreen() {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const settings = useAiSettingsQuery()
  const refresh = usePullToRefresh(() => settings.refetch())
  const setProvider = useSetActiveAiProviderMutation()
  const queryClient = useQueryClient()
  const [providerError, setProviderError] = useState<string | null>(null)

  const availableProviders = settings.data?.availableProviders ?? []
  const canChooseProvider = settings.data?.canChooseProvider ?? false

  async function handleSelectProvider(provider: AiProvider) {
    if (settings.data?.activeProvider === provider) {
      return
    }
    setProviderError(null)
    const result = await setProvider.mutateAsync(provider)
    if (!result.ok) {
      setProviderError(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
  }

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      refresh={refresh}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <SparklesIcon size={19} color={color} />}
          title={t('settings.artificial_intelligence')}
          onBack={() => router.back()}
        />
      }
    >
      <YStack gap="$2" marginTop="$5">
        <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>{t('settings.reads_your_receipts_and_creates_your_recipes')}</Text>

        {settings.data ? <AiQuotaHint access={settings.data.access} palette={palette} /> : null}

        <YStack testID="ai-features" gap="$5" marginTop="$4">
          {AI_FEATURES.map((feature) => (
            <XStack key={feature.title} alignItems="center" gap="$3">
              <YStack width={44} height={44} borderRadius={16} backgroundColor={feature.chip(palette)} alignItems="center" justifyContent="center">
                <feature.Icon size={22} color={palette.onDark} />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={15} fontWeight="800" color={palette.ink}>
                  {feature.title}
                </Text>
                <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
                  {feature.description}
                </Text>
              </YStack>
            </XStack>
          ))}
          <XStack alignItems="center" gap="$2" paddingHorizontal="$1">
            <SparklesIcon size={14} color={palette.lavenderText} />
            <Text flex={1} fontSize={12} fontWeight="600" color={palette.inkSecondary}>
              {settings.data && !canChooseProvider
                ? platformCapabilities.billing
                  ? t('settings.each_scan_or_recipe_counts_towards_your_plan_see_subscription')
                  : t('settings.each_scan_or_recipe_counts_towards_the_household_s_monthly')
                : t('settings.ai_only_runs_when_you_start_a_scan_or_request')}
            </Text>
          </XStack>
        </YStack>

        {canChooseProvider ? (
          <>
            {availableProviders.length > 1 ? (
              <Text fontSize={12} color={palette.inkSecondary}>{t('settings.the_selected_provider_applies_to_the_entire_household')}</Text>
            ) : null}
            {availableProviders.length > 1 ? (
              <YStack gap="$2" marginTop="$2">
                {availableProviders.map((provider) => (
                  <RadioCard
                    key={provider}
                    testID={`ai-provider-${provider}`}
                    label={PROVIDER_LABELS[provider]}
                    description={PROVIDER_DESCRIPTIONS[provider]}
                    selected={settings.data?.activeProvider === provider}
                    onPress={() => handleSelectProvider(provider)}
                    icon={(color) => <ProviderIcon provider={provider} color={color} />}
                    iconTint={PROVIDER_TINTS[provider]}
                    palette={palette}
                  />
                ))}
              </YStack>
            ) : null}
            {settings.data && availableProviders.length === 0 ? <AiSetupGuideCard palette={palette} /> : null}
          </>
        ) : null}

        {settings.data && canChooseProvider && availableProviders.length === 1 ? (
          // Self-hosted with a single configured provider — nothing to choose,
          // still say which one reads the tickets. Hidden on the official
          // instance: the provider is Garde-manger's business, not the foyer's.
          <YStack marginTop="$2">
            <XStack testID="ai-provider-active" alignItems="center" gap="$3">
              <YStack width={36} height={36} borderRadius={12} backgroundColor={PROVIDER_TINTS[settings.data.activeProvider]} alignItems="center" justifyContent="center">
                <ProviderIcon provider={settings.data.activeProvider} color={palette.onDark} />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="700" color={palette.ink}>
                  {PROVIDER_LABELS[settings.data.activeProvider]}
                </Text>
                <Text fontSize={12} color={palette.inkSecondary}>
                  {PROVIDER_DESCRIPTIONS[settings.data.activeProvider]}
                </Text>
              </YStack>
            </XStack>
          </YStack>
        ) : null}

        {setProvider.isPending ? (
          // The mutation had no visible state at all: on a slow connection a
          // tap on "Ollama" produced nothing until the invalidation landed.
          <Text fontSize={12} fontWeight="600" color={palette.lavenderText} accessibilityLiveRegion="polite">{t('settings.changing')}</Text>
        ) : null}
        {!settings.isPending && !settings.data ? (
          <Text fontSize={13} color={palette.expiredText}>{t('settings.couldn_t_load_settings')}</Text>
        ) : null}
        {providerError ? (
          <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
            {providerError}
          </Text>
        ) : null}
        {settings.data && !canChooseProvider && availableProviders.length > 0 ? (
          // Official instance: the operator picks and may change the provider
          // at any time, so never name it — just say it is handled.
          <Text testID="ai-provider-official" fontSize={12} fontWeight="600" color={palette.inkSecondary}>{t('settings.ai_provided_and_managed_by_garde_manger')}</Text>
        ) : null}
        {canChooseProvider && settings.data?.models.vision ? (
          <Text testID="settings-ai-models" fontSize={12} fontWeight="600" color={palette.inkSecondary}>{t('settings.vision_text', { value1: settings.data.models.vision, value2: settings.data.models.text })}</Text>
        ) : null}
      </YStack>
    </AppShell>
  )
}
