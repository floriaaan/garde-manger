export type AiProvider = 'gemini' | 'openai' | 'ollama'

/** Non-empty by construction — callers index `[0]` for the default provider. */
export const AI_PROVIDERS: readonly [AiProvider, ...AiProvider[]] = ['gemini', 'openai', 'ollama']

/**
 * `AI_PROVIDER=gemini,ollama` — the ordered whitelist of providers the
 * instance exposes. Empty or unset means "every provider the credentials
 * allow"; the first entry is the default a household gets before anyone has
 * picked. A single value (`AI_PROVIDER=gemini`, the pre-list form) still
 * reads as a one-entry list.
 *
 * Throws on an unknown entry rather than dropping it: a typo that silently
 * removes a provider from the picker is a support ticket nobody can debug.
 */
export function parseAllowedProviders(raw: string): readonly [AiProvider, ...AiProvider[]] {
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  for (const entry of entries) {
    if (!AI_PROVIDERS.includes(entry as AiProvider)) {
      throw new Error(
        `AI_PROVIDER: unknown provider "${entry}" (expected one of ${AI_PROVIDERS.join(', ')}).`,
      )
    }
  }

  return entries.length > 0 ? (entries as [AiProvider, ...AiProvider[]]) : AI_PROVIDERS
}
