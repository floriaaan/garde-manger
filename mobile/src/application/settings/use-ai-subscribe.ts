import { useState } from 'react'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useQueryClient } from '@tanstack/react-query'
import { celebrate } from '../shared/confetti.js'
import { useAiSettingsQuery } from './ai-settings.query.js'
import type { AiSettings } from '../../domain/settings/ai-settings.js'
import { useConnector } from '../shared/connector-context.js'
import type { Result } from '../../domain/shared/result.js'
import type { ApiError } from '../../domain/shared/api-error.js'

/**
 * The subscribe/manage flow every paywall shares (ADR 0015): the backend hands
 * back a Stripe-hosted page, opened in the system browser. `canSubscribe` is
 * true only on the official instance, on the free plan.
 */
export function useAiSubscribe() {
  const settings = useAiSettingsQuery()
  const connector = useConnector()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubscribe = settings.data?.access.plan === 'free'

  async function openStripePage(start: () => Promise<Result<{ url: string }, ApiError>>) {
    setError(null)
    setPending(true)
    const result = await start()
    if (!result.ok) {
      setPending(false)
      setError(result.error.message || 'Échec de l’ouverture de la page de paiement.')
      return
    }
    // Stripe's success/cancel/portal return lands on the backend, which bounces
    // into the app's deep link: the auth session closes itself on it, so the
    // user is back here without dismissing the browser by hand (closing it
    // manually still resolves the promise).
    const accessBefore = queryClient.getQueryData<AiSettings>(['ai-settings'])?.access
    await WebBrowser.openAuthSessionAsync(result.value.url, Linking.createURL('subscription'))
    setPending(false)
    // Confetti once, when a refresh first sees the household newly subscribed: free → subscriber, or a cancelled subscription reactivated.
    let celebrated = false
    const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
      const now = queryClient.getQueryData<AiSettings>(['ai-settings'])?.access
      const subscribed = accessBefore?.plan === 'free' && now?.plan === 'subscriber'
      const reactivated =
        accessBefore?.plan === 'subscriber' &&
        accessBefore.cancelsAtPeriodEnd === true &&
        now?.plan === 'subscriber' &&
        !now.cancelsAtPeriodEnd
      if (!celebrated && (subscribed || reactivated)) {
        celebrated = true
        celebrate()
      }
    }
    void refresh()
    // The Stripe webhook that flips the plan can land a moment after the browser closes.
    for (const delay of [1500, 4000, 8000]) setTimeout(() => void refresh(), delay)
  }

  return {
    canSubscribe,
    subscribe: () => openStripePage(() => connector.startSubscriptionCheckout()),
    manage: () => openStripePage(() => connector.openBillingPortal()),
    pending,
    error,
  }
}
