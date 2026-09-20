import type { UseCase } from '#application/shared/use-case'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { AiProvider } from '#domain/settings/ai-provider.vo'
import { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SetActiveAiProviderInput {
  userId: string
  provider: AiProvider
}

export type SetActiveAiProviderError =
  'not_owner' | 'provider_not_configured' | 'provider_choice_disabled'

export class SetActiveAiProvider implements UseCase<
  SetActiveAiProviderInput,
  ResultType<AiProviderSettings, SetActiveAiProviderError>
> {
  constructor(
    private readonly repository: AiProviderSettingsRepository,
    private readonly settingsProvider: AiSettingsProvider,
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: SetActiveAiProviderInput,
  ): Promise<ResultType<AiProviderSettings, SetActiveAiProviderError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    const effective = await this.settingsProvider.resolveEffective(household.id)
    // Hosted instance: the operator fixes the provider via `AI_PROVIDER`,
    // there is nothing to switch (cf. docs/superpowers/specs/2026-09-18-ai-subscription-design.md).
    if (!effective.canChooseProvider) return Result.err('provider_choice_disabled')
    if (!effective.availableProviders.includes(input.provider)) {
      return Result.err('provider_not_configured')
    }

    const now = this.clock.now()
    const existing = await this.repository.find(household.id)
    const settings =
      existing ??
      AiProviderSettings.seedFromEnv(this.idGenerator.next(), household.id, input.provider, now)
    settings.changeProvider(input.provider, input.userId, now)

    await this.repository.save(settings)
    return Result.ok(settings)
  }
}
