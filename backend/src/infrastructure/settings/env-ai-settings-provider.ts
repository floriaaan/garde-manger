import env from '#start/env'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { AiQuotaPort } from '#domain/settings/interfaces/ai-quota-port.interface'
import type { EffectiveAiSettings } from '#domain/settings/effective-ai-settings'
import type { AiAccess } from '#domain/settings/ai-access'
import type { AiProvider } from '#domain/settings/ai-provider.vo'
import { parseAllowedProviders } from '#domain/settings/ai-provider.vo'
import type { Clock } from '#domain/shared/clock.interface'

/**
 * The fixed model each cloud provider's adapters use — kept in sync by hand
 * with the `model:` literal in `gemini-receipt-extraction.adapter.ts`,
 * `gemini-recipe-generation.adapter.ts`, `openai-receipt-extraction.adapter.ts`
 * and `openai-recipe-generation.adapter.ts`. Ollama has no fixed model: its
 * name comes from `OLLAMA_VISION_MODEL`/`OLLAMA_TEXT_MODEL` below.
 */
const CLOUD_MODELS: Record<'gemini' | 'openai', { vision: string; text: string }> = {
  gemini: { vision: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
  openai: { vision: 'gpt-4o-mini', text: 'gpt-4o-mini' },
}

/**
 * Merges the household's DB row (if any) with the env whitelist — identical
 * precedence to `AuthSettingsProvider` in `arr` (DB wins once it exists, env
 * is the first-boot fallback, cf. docs/adr/0007).
 *
 * `INSTANCE_MODE` is the only switch between the two worlds this class
 * serves: self-hosted never touches `subscriptions`/`quota` and never caps
 * anything; hosted always does, and hides `PATCH /api/settings/ai` behind
 * `canChooseProvider: false` since the operator fixes the provider via
 * `AI_PROVIDER`.
 */
export class EnvAiSettingsProvider implements AiSettingsProvider {
  constructor(
    private readonly repository: AiProviderSettingsRepository,
    private readonly subscriptions: SubscriptionPort,
    private readonly quota: AiQuotaPort,
    private readonly clock: Clock,
  ) {}

  async resolveEffective(householdId: string | null): Promise<EffectiveAiSettings> {
    const allowed = parseAllowedProviders(env.get('AI_PROVIDER', ''))
    const availableProviders = allowed.filter((provider) => this.hasCredentials(provider))
    const hosted = env.get('INSTANCE_MODE', 'self-hosted') === 'hosted'

    const stored = householdId && !hosted ? await this.repository.find(householdId) : null
    const activeProvider = stored?.activeProvider ?? availableProviders[0] ?? allowed[0]

    return {
      activeProvider,
      source: stored ? 'database' : 'environment',
      availableProviders,
      canChooseProvider: !hosted,
      models: this.modelsFor(activeProvider),
      access: await this.resolveAccess(householdId, hosted),
    }
  }

  private async resolveAccess(householdId: string | null, hosted: boolean): Promise<AiAccess> {
    if (!hosted) {
      return {
        plan: 'self-hosted',
        used: 0,
        limit: null,
        resetsAt: null,
        expiresAt: null,
        cancelsAtPeriodEnd: false,
      }
    }

    const now = this.clock.now()
    const subscribed = await this.subscriptions.hasActiveSubscription(householdId)
    const plan = subscribed ? 'subscriber' : 'free'
    const limit = this.isQuotaExempt(householdId)
      ? null
      : subscribed
        ? env.get('AI_QUOTA_SUBSCRIBED', 150)
        : env.get('AI_QUOTA_FREE', 5)

    const [{ used, resetsAt }, subscription] = await Promise.all([
      householdId
        ? this.quota.usage(householdId, limit, now)
        : Promise.resolve({ used: 0, limit, resetsAt: null }),
      subscribed && householdId ? this.subscriptions.find(householdId) : Promise.resolve(null),
    ])

    return {
      plan,
      used,
      limit,
      resetsAt,
      expiresAt: subscription?.expiresAt ?? null,
      cancelsAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    }
  }

  /**
   * `AI_QUOTA_EXEMPT_HOUSEHOLD_IDS` (comma-separated) lifts the cap for chosen
   * households on the hosted instance — the App Store review account, whose
   * reviewer must be able to try every AI feature more than 5 times. Usage is
   * still counted.
   */
  private isQuotaExempt(householdId: string | null): boolean {
    if (!householdId) return false
    return env
      .get('AI_QUOTA_EXEMPT_HOUSEHOLD_IDS', '')
      .split(',')
      .map((id) => id.trim())
      .includes(householdId)
  }

  private modelsFor(provider: AiProvider): { vision: string; text: string } {
    if (provider === 'ollama') {
      return {
        vision: env.get('OLLAMA_VISION_MODEL', ''),
        text: env.get('OLLAMA_TEXT_MODEL', ''),
      }
    }
    return CLOUD_MODELS[provider]
  }

  private hasCredentials(provider: AiProvider): boolean {
    switch (provider) {
      case 'gemini':
        return Boolean(env.get('GEMINI_API_KEY', ''))
      case 'openai':
        return Boolean(env.get('OPENAI_API_KEY', ''))
      case 'ollama':
        return Boolean(env.get('OLLAMA_BASE_URL', ''))
    }
  }
}
