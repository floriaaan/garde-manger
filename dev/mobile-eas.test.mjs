// Run explicitly with: node --test dev/mobile-eas.test.mjs (no EAS commands).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { checkEnvironment, confirmProduction, plan } from './mobile-eas.mjs'

const config = JSON.parse(readFileSync(new URL('../mobile/eas.json', import.meta.url)))

test('OTA selects the channel and requires a message and matching remote env', () => {
  const message = 'Fix "session"; $(touch /tmp/should-not-exist)\nSecond line'
  const preview = plan('update', config, { CHANNEL: 'staging', MESSAGE: message })
  assert.deepEqual(preview.commands[0], ['update', '--channel', 'staging', '--environment', 'preview', '--message', message])
  assert.throws(() => plan('update', config, { CHANNEL: 'unknown', MESSAGE: message }))
  assert.throws(() => plan('update', config, { CHANNEL: 'staging', MESSAGE: ' ' }))
  assert.equal(plan('update', config, { CHANNEL: 'main', MESSAGE: message }).production, true)
  assert.equal(plan('update', config, { CHANNEL: 'main', MESSAGE: message, CONFIRM: 'production' }).commands[0][2], 'main')
  assert.throws(() => checkEnvironment(preview.profile, {}))
  assert.throws(() => checkEnvironment(preview.profile, { ...preview.profile.env, EXPO_PUBLIC_CONNECTOR: 'fake' }))
  checkEnvironment(preview.profile, preview.profile.env)
})

test('internal build uses install links; production submits only configured platforms', () => {
  assert.deepEqual(plan('build', config, { PROFILE: 'preview', PLATFORM: 'android', SUBMIT: 'auto' }).commands[0],
    ['build', '--profile', 'preview', '--platform', 'android'])
  const production = { PROFILE: 'production', PLATFORM: 'ios', SUBMIT: 'auto', CONFIRM: 'production' }
  assert.deepEqual(plan('build', config, production).commands[0],
    ['build', '--profile', 'production', '--platform', 'ios', '--auto-submit-with-profile', 'production'])
  assert.equal(plan('build', config, { ...production, CONFIRM: '' }).production, true)
  const missingAndroidSubmit = structuredClone(config)
  delete missingAndroidSubmit.submit.production.android
  assert.throws(() => plan('build', missingAndroidSubmit, { ...production, PLATFORM: 'all' }))
  assert.throws(() => plan('build', missingAndroidSubmit, { ...production, PLATFORM: 'all', SUBMIT: 'true' }))
  assert.throws(() => plan('build', config, { ...production, PLATFORM: 'wrong' }))
  assert.throws(() => plan('build', config, { PROFILE: 'preview', PLATFORM: 'ios', SUBMIT: 'true' }))
  assert.deepEqual(plan('build', config, { ...production, PLATFORM: 'android', SUBMIT: 'false' }).commands[0],
    ['build', '--profile', 'production', '--platform', 'android'])
})

test('defaults build both production platforms and update both platforms on main', () => {
  assert.deepEqual(config.submit.production.android, { track: 'alpha', releaseStatus: 'completed' })
  assert.deepEqual(plan('build', config, {}).commands, [
    ['build', '--profile', 'production', '--platform', 'all', '--auto-submit-with-profile', 'production'],
  ])
  const update = plan('update', config, { MESSAGE: 'Fix session persistence' })
  assert.deepEqual(update.commands, [
    ['update', '--channel', 'main', '--environment', 'production', '--message', 'Fix session persistence'],
  ])
  assert.equal(update.production, true)
  assert.throws(() => plan('update', config, {}))
})

test('production refuses unattended execution without explicit confirmation', async () => {
  const input = { isTTY: false }
  const output = { isTTY: false }
  await assert.rejects(confirmProduction(true, {}, input, output))
  await assert.rejects(confirmProduction(true, { CONFIRM: 'yes' }, input, output))
  await confirmProduction(true, { CONFIRM: 'production' }, input, output)
  await confirmProduction(false, {}, input, output)
})
