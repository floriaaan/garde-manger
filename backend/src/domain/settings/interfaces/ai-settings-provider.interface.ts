import type { EffectiveAiSettings } from '../effective-ai-settings.js'

export interface AiSettingsProvider {
  /** `null` for a user with no household — env defaults, nothing stored. */
  resolveEffective(householdId: string | null): Promise<EffectiveAiSettings>
}
