import { test } from '@japa/runner'
import env from '#start/env'

test.group('passkey domain associations', (group) => {
  group.each.setup(() => {
    const team = env.get('APPLE_TEAM_ID', '')
    const bundle = env.get('APPLE_APP_BUNDLE_IDENTIFIER', '')
    const fingerprint = env.get('ANDROID_APP_SIGNING_SHA256', '')
    env.set('APPLE_TEAM_ID', '')
    env.set('APPLE_APP_BUNDLE_IDENTIFIER', '')
    env.set('ANDROID_APP_SIGNING_SHA256', '')
    return () => {
      env.set('APPLE_TEAM_ID', team)
      env.set('APPLE_APP_BUNDLE_IDENTIFIER', bundle)
      env.set('ANDROID_APP_SIGNING_SHA256', fingerprint)
    }
  })

  test('unconfigured associations are not advertised', async ({ client }) => {
    const apple = await client.get('/.well-known/apple-app-site-association')
    apple.assertStatus(404)
    const android = await client.get('/.well-known/assetlinks.json')
    android.assertStatus(404)
  })

  test('Apple credentials use the team and bundle ID, not the store numeric ID', async ({
    client,
  }) => {
    env.set('APPLE_TEAM_ID', 'TEAM123')
    env.set('APPLE_APP_BUNDLE_IDENTIFIER', 'com.floriaaan.gardemanger')
    const response = await client.get('/.well-known/apple-app-site-association')
    response.assertStatus(200)
    response.assertBody({ webcredentials: { apps: ['TEAM123.com.floriaaan.gardemanger'] } })
  })

  test('Android publishes the signing fingerprint and login-credentials relation', async ({
    client,
    assert,
  }) => {
    env.set('ANDROID_APP_SIGNING_SHA256', Array(32).fill('ab').join(':'))
    const response = await client.get('/.well-known/assetlinks.json')
    response.assertStatus(200)
    assert.include(response.body()[0].relation, 'delegate_permission/common.get_login_creds')
    assert.deepEqual(response.body()[0].target, {
      namespace: 'android_app',
      package_name: 'com.floriaaan.gardemanger',
      sha256_cert_fingerprints: [Array(32).fill('AB').join(':')],
    })
  })
})
