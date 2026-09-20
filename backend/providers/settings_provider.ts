import type { ApplicationService } from '@adonisjs/core/types'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { BillingPort } from '#domain/settings/interfaces/billing-port.interface'
import type { AiQuotaPort } from '#domain/settings/interfaces/ai-quota-port.interface'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'

export default class SettingsProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('settings.aiProviderSettingsRepository', async () => {
      const { LucidAiProviderSettingsRepository } =
        await import('#infrastructure/database/settings/ai-provider-settings.repository')
      return new LucidAiProviderSettingsRepository()
    })

    this.app.container.singleton('settings.subscriptions', async () => {
      const { LucidSubscriptionAdapter } =
        await import('#infrastructure/settings/lucid-subscription.adapter')
      return new LucidSubscriptionAdapter()
    })

    this.app.container.singleton('settings.billing', async () => {
      const { StripeBillingAdapter } =
        await import('#infrastructure/settings/stripe-billing.adapter')
      return new StripeBillingAdapter()
    })

    this.app.container.singleton('settings.aiQuota', async () => {
      const { LucidAiQuotaAdapter } =
        await import('#infrastructure/settings/lucid-ai-quota.adapter')
      return new LucidAiQuotaAdapter()
    })

    this.app.container.singleton('settings.aiSettingsProvider', async () => {
      const { EnvAiSettingsProvider } =
        await import('#infrastructure/settings/env-ai-settings-provider')
      const repository = await this.app.container.make('settings.aiProviderSettingsRepository')
      const subscriptions = await this.app.container.make('settings.subscriptions')
      const quota = await this.app.container.make('settings.aiQuota')
      const clock = await this.app.container.make('shared.clock')
      return new EnvAiSettingsProvider(repository, subscriptions, quota, clock)
    })

    this.app.container.singleton('settings.resolveReceiptExtractionPort', async () => {
      const { resolveReceiptExtractionAdapter } =
        await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      const quota = await this.app.container.make('settings.aiQuota')
      const clock = await this.app.container.make('shared.clock')
      return (householdId: string | null) =>
        resolveReceiptExtractionAdapter(aiSettingsProvider, quota, clock, householdId)
    })

    this.app.container.singleton('settings.resolveRecipeGenerationPort', async () => {
      const { resolveRecipeGenerationAdapter } =
        await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      const quota = await this.app.container.make('settings.aiQuota')
      const clock = await this.app.container.make('shared.clock')
      return (householdId: string | null) =>
        resolveRecipeGenerationAdapter(aiSettingsProvider, quota, clock, householdId)
    })

    this.app.container.singleton('settings.resolveFridgeScanExtractionPort', async () => {
      const { resolveFridgeScanExtractionAdapter } =
        await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      const quota = await this.app.container.make('settings.aiQuota')
      const clock = await this.app.container.make('shared.clock')
      return (householdId: string | null) =>
        resolveFridgeScanExtractionAdapter(aiSettingsProvider, quota, clock, householdId)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'settings.aiProviderSettingsRepository': AiProviderSettingsRepository
    'settings.aiSettingsProvider': AiSettingsProvider
    'settings.subscriptions': SubscriptionPort
    'settings.billing': BillingPort
    'settings.aiQuota': AiQuotaPort
    'settings.resolveReceiptExtractionPort': (
      householdId: string | null,
    ) => Promise<ReceiptExtractionPort>
    'settings.resolveRecipeGenerationPort': (
      householdId: string | null,
    ) => Promise<RecipeGenerationPort>
    'settings.resolveFridgeScanExtractionPort': (
      householdId: string | null,
    ) => Promise<FridgeScanExtractionPort>
  }
}
