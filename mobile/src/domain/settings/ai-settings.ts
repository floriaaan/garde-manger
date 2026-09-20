export type AiProvider = 'gemini' | 'openai' | 'ollama'

export const AI_PROVIDERS: readonly AiProvider[] = ['gemini', 'openai', 'ollama']

export type AiPlan = 'self-hosted' | 'free' | 'subscriber'

export interface AiAccess {
  plan: AiPlan
  used: number
  limit: number | null
  resetsAt: string | null
  expiresAt: string | null
  /** Cancelled: access runs until `expiresAt`, then drops to free. */
  cancelsAtPeriodEnd?: boolean
}

/** Mirrors `AiSettingsDto` (= backend's `EffectiveAiSettings`) field-for-field. */
export interface AiSettings {
  activeProvider: AiProvider
  source: 'database' | 'environment'
  availableProviders: AiProvider[]
  /** `false` on the hosted instance — the operator fixes the provider there. */
  canChooseProvider: boolean
  /** The active provider's vision/text model — `''` when unset (Ollama only). */
  models: { vision: string; text: string }
  access: AiAccess
}
