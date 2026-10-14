import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Clock } from '#domain/shared/clock.interface'
import type { WebhookSignatureVerifier } from '#domain/settings/interfaces/webhook-signature-verifier.interface'

const SIGNATURE_TOLERANCE_SECONDS = 300

/** Stripe HMAC-SHA256 verification over the raw body, with a five-minute replay window. */
export class StripeSignatureVerifier implements WebhookSignatureVerifier {
  constructor(private readonly clock: Clock) {}

  isValid(rawBody: string, header: string, secret: string): boolean {
    const nowSeconds = Math.floor(this.clock.now().getTime() / 1000)
    const parts = header.split(',').map((part) => part.split('=') as [string, string])
    const timestamp = Number(parts.find(([key]) => key === 't')?.[1])
    if (
      !Number.isFinite(timestamp) ||
      Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS
    ) {
      return false
    }
    const expected = Buffer.from(
      createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'),
    )
    return parts
      .filter(([key]) => key === 'v1')
      .some(([, signature]) => {
        const provided = Buffer.from(signature ?? '')
        return provided.length === expected.length && timingSafeEqual(provided, expected)
      })
  }
}
