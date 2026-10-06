// Run explicitly with: node --test dev/mobile-eas.test.mjs (no EAS commands).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { checkEnvironment, plan } from './mobile-eas.mjs'

const config = JSON.parse(readFileSync(new URL('../mobile/eas.json', import.meta.url)))

test('OTA requires a known channel, message, production confirmation and matching remote env', () => {
  const message = 'Fix "session"; $(touch /tmp/should-not-exist)\nSecond line'
  const preview = plan('update', config, { CHANNEL: 'preview', MESSAGE: message })
  assert.deepEqual(preview.args, ['update', '--channel', 'preview', '--environment', 'preview', '--message', message])
  assert.throws(() => plan('update', config, { CHANNEL: 'unknown', MESSAGE: message }))
  assert.throws(() => plan('update', config, { CHANNEL: 'preview', MESSAGE: ' ' }))
  assert.throws(() => plan('update', config, { CHANNEL: 'production', MESSAGE: message }))
  assert.equal(plan('update', config, { CHANNEL: 'production', MESSAGE: message, CONFIRM: 'production' }).args[2], 'production')
  assert.throws(() => checkEnvironment(preview.profile, {}))
  assert.throws(() => checkEnvironment(preview.profile, { ...preview.profile.env, EXPO_PUBLIC_CONNECTOR: 'fake' }))
  checkEnvironment(preview.profile, preview.profile.env)
})

test('internal build uses install links; production submits only configured platforms', () => {
  assert.deepEqual(plan('build', config, { PROFILE: 'preview', PLATFORM: 'android', SUBMIT: 'auto' }).args,
    ['build', '--profile', 'preview', '--platform', 'android'])
  const production = { PROFILE: 'production', PLATFORM: 'ios', SUBMIT: 'auto', CONFIRM: 'production' }
  assert.deepEqual(plan('build', config, production).args,
    ['build', '--profile', 'production', '--platform', 'ios', '--auto-submit-with-profile', 'production'])
  assert.throws(() => plan('build', config, { ...production, CONFIRM: '' }))
  assert.throws(() => plan('build', config, { ...production, PLATFORM: 'all' }))
  assert.throws(() => plan('build', config, { ...production, PLATFORM: 'wrong' }))
  assert.throws(() => plan('build', config, { PROFILE: 'preview', PLATFORM: 'ios', SUBMIT: 'true' }))
  assert.deepEqual(plan('build', config, { ...production, PLATFORM: 'android', SUBMIT: 'false' }).args,
    ['build', '--profile', 'production', '--platform', 'android'])
})
