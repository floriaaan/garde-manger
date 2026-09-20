import { createHmac, timingSafeEqual } from 'node:crypto'

const SIGNATURE_TOLERANCE_SECONDS = 300

/**
 * Checks a `Stripe-Signature` header (`t=<unix>,v1=<hmac>[,v1=…]`) against the
 * raw request body: HMAC-SHA256 of `<t>.<body>` with the endpoint secret, within
 * a five-minute window so a captured payload cannot be replayed later.
 */
export function isValidStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
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
