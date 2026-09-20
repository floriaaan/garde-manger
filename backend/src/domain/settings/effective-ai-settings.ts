import type { AiProvider } from './ai-provider.vo.js'
import type { AiAccess } from './ai-access.js'

/** Never persisted — `AiSettingsProvider.resolveEffective()`'s return shape. */
export interface EffectiveAiSettings {
  activeProvider: AiProvider
  source: 'database' | 'environment'
  /** Whitelisted and credentialed — what the foyer can pick from. */
  availableProviders: AiProvider[]
  /**
   * Whether the foyer may pick among `availableProviders` at all — `false`
   * on the hosted instance, where the operator fixes the provider via
   * `AI_PROVIDER` and `PATCH /api/settings/ai` is refused.
   */
  canChooseProvider: boolean
  /**
   * The vision/text models the active provider actually uses — `''` when
   * unset (only possible for Ollama, whose model names are env-configured
   * rather than fixed). Lets the app warn before a scan/generation call
   * that would otherwise fail with a bare `provider_not_configured`.
   */
  models: { vision: string; text: string }
  access: AiAccess
}
