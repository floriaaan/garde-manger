import type { EffectiveAiSettings } from '../effective-ai-settings.js'

export interface AiSettingsProvider {
  /** `null` for a user with no household — env defaults, nothing stored. */
  /** False on iOS: neither Stripe entitlement nor quota exemption unlocks paid usage. */
  resolveEffective(householdId: string | null, allowPaidAccess?: boolean): Promise<EffectiveAiSettings>
}
