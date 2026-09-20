import { useAiSettingsQuery } from './ai-settings.query.js'
import type { AiAccess } from '../../domain/settings/ai-settings.js'

export type AiAccessState =
  | { status: 'loading' }
  | { status: 'ok'; access: AiAccess }
  | { status: 'setup-needed' }
  | { status: 'subscription-needed'; access: AiAccess }
  | { status: 'quota-exceeded'; access: AiAccess }

/**
 * One read of `access.plan`/`used`/`limit` (cf. `EffectiveAiSettings.access`,
 * ADR 0014) turned into the four UI states the paywall/quota components
 * actually branch on, so screens don't each re-derive the same thresholds.
 */
export function useAiAccess(): AiAccessState {
  const settings = useAiSettingsQuery()
  if (settings.isPending || !settings.data) return { status: 'loading' }

  const { access, availableProviders } = settings.data
  if (access.plan === 'self-hosted') {
    return availableProviders.length === 0 ? { status: 'setup-needed' } : { status: 'ok', access }
  }
  if (access.limit !== null && access.used >= access.limit) {
    return access.plan === 'free' ? { status: 'subscription-needed', access } : { status: 'quota-exceeded', access }
  }
  return { status: 'ok', access }
}
