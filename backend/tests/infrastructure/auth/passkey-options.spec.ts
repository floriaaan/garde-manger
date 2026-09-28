import { test } from '@japa/runner'
import { buildPasskeyOptions } from '#infrastructure/auth/better-auth/passkey-options'

const defaults = {
  networkUrl: 'https://api.example.com',
  rpID: '',
  webOrigins: '',
  androidFingerprint: '',
}

test('passkeys preserve the native RP ID and encode Android origins without padding', ({
  assert,
}) => {
  const options = buildPasskeyOptions({
    ...defaults,
    androidFingerprint: Array(32).fill('FF').join(':'),
  })
  assert.equal(options.rpID, 'api.example.com')
  assert.deepEqual(options.origin, [
    'https://api.example.com',
    `android:apk-key-hash:${'_'.repeat(42)}8`,
  ])
})

test('a web subdomain can share existing credentials without changing the RP ID', ({ assert }) => {
  const options = buildPasskeyOptions({
    ...defaults,
    webOrigins: 'https://web.api.example.com,https://web.api.example.com',
  })
  assert.equal(options.rpID, defaults.networkUrl.replace('https://', ''))
  assert.deepEqual(options.origin, ['https://api.example.com', 'https://web.api.example.com'])
})

test('an explicit shared RP ID permits sibling web origins', ({ assert }) => {
  const options = buildPasskeyOptions({
    ...defaults,
    rpID: 'example.com',
    webOrigins: 'https://app.example.com',
  })
  assert.equal(options.rpID, 'example.com')
  assert.include(options.origin, 'https://app.example.com')
})

test('invalid fingerprints and incompatible or lookalike web origins fail at startup', ({
  assert,
}) => {
  assert.throws(() => buildPasskeyOptions({ ...defaults, androidFingerprint: 'FF:AA' }))
  for (const webOrigins of [
    'https://app.example.com',
    'https://evilapi.example.com',
    'https://api.example.com/path',
  ]) {
    assert.throws(() => buildPasskeyOptions({ ...defaults, webOrigins }))
  }
})
