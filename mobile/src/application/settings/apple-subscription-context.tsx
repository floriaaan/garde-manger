import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import type { ApplePurchase, AppleProduct, ApplePurchases, AppleSubscriptionConfig } from '../../domain/settings/apple-purchases.js'
import { useConnector } from '../shared/connector-context.js'
import { useSessionQuery } from '../identity/session.query.js'
import { useHouseholdQuery } from '../identity/household.query.js'
import { t } from '../../i18n/index.js'
import { getServerUrl, onServerUrlChange } from '../shared/server-config.js'

const noop = async () => {}
interface AppleSubscriptionState {
  product: AppleProduct | null
  pending: boolean
  error: string | null
  notice: string | null
  subscribe: () => Promise<void>
  restore: () => Promise<void>
  manage: () => Promise<void>
  retry: () => void
}
const AppleSubscriptionContext = createContext<AppleSubscriptionState>({
  product: null, pending: false, error: null, notice: null,
  subscribe: noop, restore: noop, manage: noop, retry: () => {},
})

/** One listener for the whole authenticated app, including interrupted purchases. */
export function AppleSubscriptionProvider({ purchases, children }: { purchases: ApplePurchases | null; children: ReactNode }) {
  const connector = useConnector()
  const queryClient = useQueryClient()
  const serverUrl = useSyncExternalStore(onServerUrlChange, getServerUrl, getServerUrl)
  const session = useSessionQuery()
  const household = useHouseholdQuery({ enabled: !!purchases && !!session.data })
  const [product, setProduct] = useState<AppleProduct | null>(null)
  const [config, setConfig] = useState<AppleSubscriptionConfig | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const lifecycle = useRef(0)
  const ready = useRef(false)
  const operation = useRef<'purchase' | 'restore' | 'manage' | null>(null)
  const activeProcess = useRef<((purchase: ApplePurchase) => Promise<boolean>) | null>(null)
  const userId = session.data?.user.id
  const householdId = household.data?.id

  // Reset before rendering a changed account, server, or retry scope.
  const scope = [purchases, connector, userId, householdId, serverUrl, queryClient, attempt]
  const [previousScope, setPreviousScope] = useState(scope)
  if (scope.some((value, index) => value !== previousScope[index])) {
    setPreviousScope(scope)
    setPending(false)
    setProduct(null)
    setConfig(null)
    setError(null)
    setNotice(null)
  }

  useEffect(() => {
    if (!purchases || !userId || !householdId) return
    ++lifecycle.current
    let active = true
    let close: (() => void) | undefined
    const processing = new Map<string, Promise<boolean>>()
    ready.current = false
    operation.current = null

    const finishPurchaseAttempt = () => {
      if (operation.current === 'purchase') { operation.current = null; setPending(false) }
    }
    const process = (purchase: ApplePurchase): Promise<boolean> => {
      const existing = processing.get(purchase.id)
      if (existing) return existing
      const task = (async () => {
        if (!active) return false
        const result = await connector.syncAppleSubscription(purchase.signedTransaction)
        if (!active) return false
        if (!result.ok) {
          setError(result.error.message)
          finishPurchaseAttempt()
          return false // leave unfinished so StoreKit can deliver it again
        }
        await purchases.finish(purchase)
        if (!active) return false
        await queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
        finishPurchaseAttempt()
        setError(null)
        return result.value.active
      })().catch(() => {
        if (active) { finishPurchaseAttempt(); setError(t('settings.apple_verification_retry')) }
        return false
      }).finally(() => processing.delete(purchase.id))
      processing.set(purchase.id, task)
      return task
    }

    void (async () => {
      const result = await connector.getAppleSubscription()
      if (!active) return
      if (!result.ok) { setError(result.error.message); return }
      const expectedProduct = result.value.productId
      activeProcess.current = (purchase) => purchase.productId === expectedProduct ? process(purchase) : Promise.resolve(false)
      close = await purchases.connect(async (purchase) => { if (active) await activeProcess.current?.(purchase) }, (code) => {
        if (!active) return
        finishPurchaseAttempt()
        if (code === 'user-cancelled') return
        if (code === 'deferred-payment' || code === 'pending') setNotice(t('settings.apple_purchase_pending'))
        else setError(t('settings.apple_purchase_failed'))
      })
      if (!active) { close(); return }
      ready.current = true
      setConfig(result.value)
      for (const purchase of await purchases.current()) await activeProcess.current?.(purchase)
      const loadedProduct = await purchases.product(expectedProduct)
      if (active) setProduct(loadedProduct)
    })().catch(() => {
      if (active) setError(t('settings.apple_purchase_failed'))
    })

    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active' && ready.current) {
        void purchases.current().then(async (items) => {
          for (const purchase of items) await activeProcess.current?.(purchase)
        }).catch(() => { if (active) setError(t('settings.apple_verification_retry')) })
      }
    })
    return () => { ++lifecycle.current; active = false; ready.current = false; activeProcess.current = null; close?.(); foreground.remove() }
  }, [purchases, connector, userId, householdId, serverUrl, queryClient, attempt])

  async function subscribe() {
    if (!purchases || !ready.current || !product || !config || operation.current) return
    const scope = lifecycle.current
    operation.current = 'purchase'
    setPending(true); setError(null); setNotice(null)
    try {
      // Check again immediately before purchase to avoid paying Apple while Stripe is active.
      const latest = await connector.getAppleSubscription()
      if (scope !== lifecycle.current) return
      if (!latest.ok || latest.value.productId !== product.id || !latest.value.canPurchase) {
        operation.current = null
        setPending(false)
        setError(!latest.ok ? latest.error.message : latest.value.productId !== product.id
          ? t('settings.apple_verification_retry') : t('settings.household_already_subscribed'))
        return
      }
      await purchases.purchase(product.id, latest.value.appAccountToken)
      // Completion is event-based; neither this promise nor a local receipt unlocks access.
    } catch (failure) {
      if (scope !== lifecycle.current) return
      operation.current = null
      setPending(false)
      const code = (failure as { code?: string })?.code
      if (code === 'pending' || code === 'deferred-payment') setNotice(t('settings.apple_purchase_pending'))
      else if (code !== 'user-cancelled') setError(t('settings.apple_purchase_failed'))
    }
  }

  async function restore() {
    if (!purchases || !ready.current || operation.current) return
    const scope = lifecycle.current
    operation.current = 'restore'
    setPending(true); setError(null); setNotice(null)
    try {
      let restored = false
      const restoredPurchases = await purchases.restore()
      if (scope !== lifecycle.current) return
      for (const purchase of restoredPurchases) {
        if (await activeProcess.current?.(purchase)) restored = true
      }
      setNotice(t(restored ? 'settings.apple_restored' : 'settings.apple_nothing_to_restore'))
    } catch { if (scope === lifecycle.current) setError(t('settings.apple_verification_retry')) }
    finally { if (scope === lifecycle.current) { operation.current = null; setPending(false) } }
  }

  async function manage() {
    if (!purchases || operation.current) return
    const scope = lifecycle.current
    operation.current = 'manage'
    setPending(true); setError(null)
    try {
      await purchases.manage()
      if (scope !== lifecycle.current) return
      for (const purchase of await purchases.current()) await activeProcess.current?.(purchase)
      await queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
    } catch { if (scope === lifecycle.current) setError(t('settings.apple_purchase_failed')) }
    finally { if (scope === lifecycle.current) { operation.current = null; setPending(false) } }
  }

  return <AppleSubscriptionContext.Provider value={{ product, pending, error, notice, subscribe, restore, manage, retry: () => setAttempt((value) => value + 1) }}>{children}</AppleSubscriptionContext.Provider>
}

export function useAppleSubscription() { return useContext(AppleSubscriptionContext) }
