export interface ApplePurchase {
  id: string
  productId: string
  signedTransaction: string
}

export interface AppleSubscriptionConfig {
  productId: string
  appAccountToken: string
  canPurchase: boolean
}

export interface AppleProduct { id: string; displayPrice: string; title: string }

/** Native StoreKit boundary. Null on Android/web; they keep Stripe. */
export interface ApplePurchases {
  connect(onPurchase: (purchase: ApplePurchase) => Promise<void>, onError: (code: string) => void): Promise<() => void>
  product(id: string): Promise<AppleProduct>
  purchase(productId: string, appAccountToken: string): Promise<void>
  restore(): Promise<ApplePurchase[]>
  current(): Promise<ApplePurchase[]>
  finish(purchase: ApplePurchase): Promise<void>
  manage(): Promise<void>
}
