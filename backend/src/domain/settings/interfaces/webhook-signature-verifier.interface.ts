/** Verifies a webhook signature against its unmodified request body. */
export interface WebhookSignatureVerifier {
  isValid(rawBody: string, signature: string, secret: string): boolean
}
