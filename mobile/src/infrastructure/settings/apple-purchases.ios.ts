import * as IAP from 'expo-iap'
import type { ApplePurchase, ApplePurchases } from '../../domain/settings/apple-purchases.js'

let previousConnection = Promise.resolve()
const transactions = new Map<string, IAP.Purchase>()

function remember(purchase: IAP.Purchase): ApplePurchase | null {
  if (purchase.purchaseState !== 'purchased' || !purchase.purchaseToken) return null
  transactions.set(purchase.id, purchase)
  return { id: purchase.id, productId: purchase.productId, signedTransaction: purchase.purchaseToken }
}

export const applePurchases: ApplePurchases = {
  async connect(onPurchase, onError) {
    // StoreKit has one native connection; finish an old account's cleanup first.
    const previous = previousConnection
    let release!: () => void
    previousConnection = new Promise<void>((resolve) => { release = resolve })
    await previous
    let updates: { remove: () => void } | undefined
    let errors: { remove: () => void } | undefined
    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      updates?.remove()
      errors?.remove()
      transactions.clear()
      void IAP.endConnection().catch(() => {}).finally(release)
    }
    try {
      updates = IAP.purchaseUpdatedListener((purchase) => {
        if (purchase.purchaseState === 'pending') { onError('pending'); return }
        const transaction = remember(purchase)
        if (transaction) void onPurchase(transaction).catch(() => onError('verification-failed'))
      })
      errors = IAP.purchaseErrorListener((error) => onError(error.code))
      if (!await IAP.initConnection()) throw new Error('StoreKit unavailable')
      for (const purchase of await IAP.getPendingTransactionsIOS()) {
        const transaction = remember(purchase)
        if (transaction) await onPurchase(transaction)
      }
      return close
    } catch (error) { close(); throw error }
  },

  async product(id) {
    const products = await IAP.fetchProducts({ skus: [id], type: 'subs' })
    const product = products?.find((item) => item.id === id)
    // This release sells one monthly, auto-renewing subscription only.
    if (!product || !('subscriptionPeriodUnitIOS' in product) || product.subscriptionPeriodUnitIOS !== 'month' || product.subscriptionPeriodNumberIOS !== '1') {
      throw new Error('Monthly App Store product unavailable')
    }
    return { id: product.id, displayPrice: product.displayPrice, title: product.title }
  },

  async purchase(productId, appAccountToken) {
    await IAP.requestPurchase({ type: 'subs', request: { apple: {
      sku: productId, appAccountToken, andDangerouslyFinishTransactionAutomatically: false,
    } } })
  },

  async current() {
    const purchases = await IAP.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true, alsoPublishToEventListenerIOS: false })
    return purchases.map(remember).filter((purchase): purchase is ApplePurchase => purchase !== null)
  },

  async restore() {
    await IAP.restorePurchases() // AppStore.sync, only after an explicit user action.
    return this.current()
  },

  async finish(purchase) {
    const native = transactions.get(purchase.id)
    if (!native) throw new Error('Transaction no longer available')
    await IAP.finishTransaction({ purchase: native, isConsumable: false })
    transactions.delete(purchase.id)
  },

  async manage() { await IAP.showManageSubscriptionsIOS() },
}
