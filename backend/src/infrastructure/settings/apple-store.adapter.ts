import { readFile } from 'node:fs/promises'
import { v5 as uuidv5 } from 'uuid'
import { AppStoreServerAPIClient, Environment, SignedDataVerifier, Status, Type, VerificationException, VerificationStatus } from '@apple/app-store-server-library'
import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library'
import env from '#start/env'
import type { AppleEntitlement, AppleStorePort } from '#domain/settings/interfaces/apple-subscription-port.interface'
import { InvalidApplePurchaseError } from '#domain/settings/interfaces/apple-subscription-port.interface'

export async function createAppleStore(): Promise<AppleStorePort | null> {
  if (env.get('INSTANCE_MODE', 'self-hosted') !== 'hosted') return null
  const productId = env.get('APPLE_IAP_PRODUCT_ID', '')
  const issuerId = env.get('APPLE_IAP_ISSUER_ID', '')
  const keyId = env.get('APPLE_IAP_KEY_ID', '')
  const privateKey = env.get('APPLE_IAP_PRIVATE_KEY', '').replace(/\\n/g, '\n')
  if (!productId || !issuerId || !keyId || !privateKey) return null
  const roots = await Promise.all(['G2', 'G3'].map((generation) =>
    readFile(new URL(`../../../resources/apple/AppleRootCA-${generation}.cer`, import.meta.url))))
  const bundleId = env.get('APPLE_IAP_BUNDLE_ID', 'com.floriaaan.gardemanger')
  const appId = env.get('APPLE_IAP_APP_ID', 6816469647)
  const environments = env.get('APPLE_IAP_ALLOW_SANDBOX', false)
    ? [Environment.PRODUCTION, Environment.SANDBOX] : [Environment.PRODUCTION]
  return new AppleStoreAdapter(productId, environments.map((environment) => ({
    environment,
    verifier: new SignedDataVerifier(roots, true, environment, bundleId, appId),
    client: new AppStoreServerAPIClient(privateKey, keyId, issuerId, bundleId, environment),
  })))
}

interface AppleConnection {
  environment: Environment
  verifier: SignedDataVerifier
  client: AppStoreServerAPIClient
}

export class AppleStoreAdapter implements AppleStorePort {
  constructor(readonly productId: string, private readonly connections: AppleConnection[]) {}

  accountToken(userId: string): string {
    // Stable across sign-ins and restores; no Apple secret goes to the phone.
    return uuidv5(`com.floriaaan.gardemanger:apple:${userId}`, uuidv5.DNS)
  }

  async verifyPurchase(signedTransaction: string): Promise<AppleEntitlement> {
    for (const connection of this.connections) {
      let transaction: JWSTransactionDecodedPayload
      try { transaction = await connection.verifier.verifyAndDecodeTransaction(signedTransaction) }
      catch (error) {
        if (error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE) throw error
        continue
      }
      this.assertTransaction(transaction)
      return this.current(connection, transaction)
    }
    throw new InvalidApplePurchaseError('Invalid Apple transaction')
  }

  async verifyNotification(signedPayload: string): Promise<AppleEntitlement | null> {
    for (const connection of this.connections) {
      let notification
      try { notification = await connection.verifier.verifyAndDecodeNotification(signedPayload) }
      catch (error) {
        if (error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE) throw error
        continue
      }
      if (!notification.data?.signedTransactionInfo) return null // includes Apple's TEST event
      const transaction = await connection.verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo)
      if (transaction.productId !== this.productId) return null
      this.assertTransaction(transaction)
      // Fetch current status rather than applying an old/out-of-order notification.
      return this.current(connection, transaction)
    }
    throw new InvalidApplePurchaseError('Invalid Apple notification')
  }

  private assertTransaction(transaction: JWSTransactionDecodedPayload): void {
    if (transaction.productId !== this.productId || transaction.type !== Type.AUTO_RENEWABLE_SUBSCRIPTION ||
      transaction.inAppOwnershipType !== 'PURCHASED' || !transaction.originalTransactionId || !transaction.appAccountToken) {
      throw new InvalidApplePurchaseError('Unexpected Apple product or account')
    }
  }

  private async current(connection: AppleConnection, submitted: JWSTransactionDecodedPayload): Promise<AppleEntitlement> {
    const response = await connection.client.getAllSubscriptionStatuses(submitted.originalTransactionId!)
    const entry = response.data?.flatMap((group) => group.lastTransactions ?? [])
      .find((item) => item.originalTransactionId === submitted.originalTransactionId)
    if (!entry?.signedTransactionInfo || !entry.signedRenewalInfo) {
      throw new InvalidApplePurchaseError('Apple subscription not found')
    }
    const [transaction, renewal] = await Promise.all([
      connection.verifier.verifyAndDecodeTransaction(entry.signedTransactionInfo),
      connection.verifier.verifyAndDecodeRenewalInfo(entry.signedRenewalInfo),
    ])
    this.assertTransaction(transaction)
    if (transaction.originalTransactionId !== submitted.originalTransactionId ||
      transaction.appAccountToken !== submitted.appAccountToken || renewal.originalTransactionId !== submitted.originalTransactionId ||
      !transaction.expiresDate || !transaction.signedDate || !renewal.signedDate) {
      throw new InvalidApplePurchaseError('Apple subscription does not match transaction')
    }
    const entitled = !transaction.revocationDate && (entry.status === Status.ACTIVE || entry.status === Status.BILLING_GRACE_PERIOD)
    const expiresAt = entitled
      ? entry.status === Status.BILLING_GRACE_PERIOD ? renewal.gracePeriodExpiresDate ?? transaction.expiresDate : transaction.expiresDate
      : 0
    return {
      id: `${connection.environment}:${transaction.originalTransactionId}`,
      originalTransactionId: transaction.originalTransactionId!,
      environment: connection.environment === Environment.PRODUCTION ? 'Production' : 'Sandbox',
      appAccountToken: transaction.appAccountToken!,
      expiresAt: new Date(expiresAt),
      cancelAtPeriodEnd: renewal.autoRenewStatus === 0,
      signedAt: new Date(Math.max(transaction.signedDate, renewal.signedDate)),
    }
  }
}
