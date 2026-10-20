import { test } from '@japa/runner'
import { createHmac } from 'node:crypto'
import { StripeSignatureVerifier } from '#infrastructure/settings/stripe-signature-verifier'

test.group('StripeSignatureVerifier', () => {
  const secret = 'whsec_test'
  const body = '{"type":"customer.subscription.updated"}'
  const now = 1_800_000_000
  const verifier = new StripeSignatureVerifier({ now: () => new Date(now * 1000) })
  const sign = (timestamp: number) =>
    createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

  test('accepts a fresh, correctly signed payload', ({ assert }) => {
    assert.isTrue(verifier.isValid(body, `t=${now},v1=${sign(now)}`, secret))
  })

  test('rejects a tampered body, a wrong secret, a stale timestamp and no header', ({ assert }) => {
    assert.isFalse(verifier.isValid(`${body} `, `t=${now},v1=${sign(now)}`, secret))
    assert.isFalse(verifier.isValid(body, `t=${now},v1=${sign(now)}`, 'whsec_other'))
    assert.isFalse(verifier.isValid(body, `t=${now - 600},v1=${sign(now - 600)}`, secret))
    assert.isFalse(verifier.isValid(body, '', secret))
  })
})
