import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type { BillingPort } from '#domain/settings/interfaces/billing-port.interface'

const STRIPE_API = 'https://api.stripe.com/v1'

/**
 * Talks to Stripe over plain `fetch` (form-encoded, as its API expects) — three
 * endpoints do not justify the SDK. Only ever used when `INSTANCE_MODE=hosted`.
 */
export class StripeBillingAdapter implements BillingPort {
  async createCheckoutUrl(params: {
    householdId: string
    payerUserId: string
    customerId: string | null
  }): Promise<string> {
    const returnUrl = this.returnUrl()
    const metadata = { household_id: params.householdId, payer_user_id: params.payerUserId }
    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': env.get('STRIPE_PRICE_ID', ''),
      'line_items[0][quantity]': '1',
      client_reference_id: params.householdId,
      success_url: returnUrl,
      cancel_url: returnUrl,
      // Copied onto the subscription itself so every `customer.subscription.*`
      // event carries the household without a lookup (cf. `HandleStripeWebhook`).
      'subscription_data[metadata][household_id]': metadata.household_id,
      'subscription_data[metadata][payer_user_id]': metadata.payer_user_id,
    })
    if (params.customerId) body.set('customer', params.customerId)
    const session = await this.post('/checkout/sessions', body)
    return session.url
  }

  async createPortalUrl(customerId: string): Promise<string> {
    const session = await this.post(
      '/billing_portal/sessions',
      new URLSearchParams({ customer: customerId, return_url: this.returnUrl() }),
    )
    return session.url
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      const response = await fetch(
        `${STRIPE_API}/subscriptions/${encodeURIComponent(subscriptionId)}`,
        {
          method: 'DELETE',
          headers: this.headers(),
        },
      )
      if (!response.ok) throw new Error(`Stripe ${response.status}`)
    } catch (error) {
      logger.warn({ err: error, subscriptionId }, 'stripe.cancel_subscription_failed')
    }
  }

  private returnUrl(): string {
    return env.get('STRIPE_RETURN_URL', `${env.get('APP_URL')}/api/settings/subscription/return`)
  }

  private headers() {
    return { authorization: `Bearer ${env.get('STRIPE_SECRET_KEY', '')}` }
  }

  private async post(path: string, body: URLSearchParams): Promise<{ url: string }> {
    const response = await fetch(`${STRIPE_API}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!response.ok)
      throw new Error(`Stripe ${path} failed: ${response.status} ${await response.text()}`)
    return (await response.json()) as { url: string }
  }
}
