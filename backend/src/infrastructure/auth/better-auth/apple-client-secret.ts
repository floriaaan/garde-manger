import { createSign } from 'node:crypto'

/**
 * Sign in with Apple has no static client secret: better-auth wants a JWT,
 * signed ES256 with the `.p8` private key, that Apple accepts for up to six
 * months (docs/adr/0020). Generating it at startup from the key avoids
 * storing a secret that silently expires.
 */
export interface AppleClientSecretOptions {
  clientId: string
  teamId: string
  keyId: string
  privateKey: string
  /** Seconds until expiry. Apple's own cap is 15777000 (~6 months). */
  expiresInSeconds?: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function buildAppleClientSecret({
  clientId,
  teamId,
  keyId,
  privateKey,
  expiresInSeconds = 15777000,
}: AppleClientSecretOptions): string {
  const header = { alg: 'ES256', kid: keyId }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + expiresInSeconds,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  // ES256 (JWS) wants the raw r||s signature, not the DER encoding
  // node's crypto produces by default — `ieee-p1363` asks for the former.
  const signature = createSign('SHA256')
    .update(signingInput)
    .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })

  return `${signingInput}.${base64url(signature)}`
}
