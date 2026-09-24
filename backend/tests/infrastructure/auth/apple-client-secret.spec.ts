import { test } from '@japa/runner'
import { createVerify, generateKeyPairSync } from 'node:crypto'
import { buildAppleClientSecret } from '#infrastructure/auth/better-auth/apple-client-secret'

test.group('buildAppleClientSecret', () => {
  test('signs an ES256 JWT that verifies against the matching public key', ({ assert }) => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })

    const jwt = buildAppleClientSecret({
      clientId: 'com.floriaaan.gardemanger.signin',
      teamId: 'TEAM123',
      keyId: 'KEY456',
      privateKey,
    })

    const [headerPart, payloadPart, signaturePart] = jwt.split('.')
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString())
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString())

    assert.deepEqual(header, { alg: 'ES256', kid: 'KEY456' })
    assert.equal(payload.iss, 'TEAM123')
    assert.equal(payload.sub, 'com.floriaaan.gardemanger.signin')
    assert.equal(payload.aud, 'https://appleid.apple.com')
    assert.isBelow(payload.exp - payload.iat, 15777001)

    const verified = createVerify('SHA256')
      .update(`${headerPart}.${payloadPart}`)
      .verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signaturePart, 'base64url'))
    assert.isTrue(verified)
  })
})
