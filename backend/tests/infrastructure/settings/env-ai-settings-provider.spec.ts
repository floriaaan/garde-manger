import { test } from '@japa/runner'
import env from '#start/env'
import { EnvAiSettingsProvider } from '#infrastructure/settings/env-ai-settings-provider'
import { resolveReceiptExtractionAdapter } from '#infrastructure/settings/ai-provider-registry'
import { AiQuotaExceededError } from '#domain/settings/ai-quota-exceeded.error'
import type { AiQuotaPort } from '#domain/settings/interfaces/ai-quota-port.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'

const clock: Clock = { now: () => new Date('2026-09-18T10:00:00Z') }

const noStoredSettings: AiProviderSettingsRepository = {
  async find() {
    return null
  },
  async save() {},
}

const neverSubscribed = {
  async hasActiveSubscription() {
    return false
  },
  async find() {
    return null
  },
} as unknown as SubscriptionPort

/** Every household has already used 40 calls this month — far past the free quota. */
const heavyUsage: AiQuotaPort = {
  async usage(_householdId, limit) {
    return { used: 40, limit, resetsAt: new Date('2026-10-01T00:00:00Z') }
  },
  async record() {},
}

function provider() {
  return new EnvAiSettingsProvider(noStoredSettings, neverSubscribed, heavyUsage, clock)
}

test.group('EnvAiSettingsProvider — AI_QUOTA_EXEMPT_HOUSEHOLD_IDS', (group) => {
  // `env.set`, not `process.env`: a variable validated at boot (INSTANCE_MODE
  // from .env.test) wins over `process.env` in `env.get`.
  const saved = {
    mode: env.get('INSTANCE_MODE', 'self-hosted'),
    exempt: env.get('AI_QUOTA_EXEMPT_HOUSEHOLD_IDS', ''),
  }
  group.each.setup(() => {
    env.set('INSTANCE_MODE', 'hosted')
    env.set('AI_QUOTA_EXEMPT_HOUSEHOLD_IDS', 'h_other, h_review')
  })
  group.each.teardown(() => {
    env.set('INSTANCE_MODE', saved.mode)
    env.set('AI_QUOTA_EXEMPT_HOUSEHOLD_IDS', saved.exempt)
  })

  test('an exempt household has no cap', async ({ assert }) => {
    const { access } = await provider().resolveEffective('h_review')
    assert.isNull(access.limit)
    assert.equal(access.used, 40)
  })

  test('any other household keeps the free quota', async ({ assert }) => {
    const { access } = await provider().resolveEffective('h_someone')
    assert.equal(access.plan, 'free')
    assert.equal(access.limit, 5)
  })

  test('the registry lets an exempt household through and still refuses the others', async ({
    assert,
  }) => {
    // Hosted adapters come wrapped to record usage — resolving at all is the point.
    const adapter = await resolveReceiptExtractionAdapter(provider(), heavyUsage, clock, 'h_review')
    assert.isFunction(adapter.extract)

    await assert.rejects(
      () => resolveReceiptExtractionAdapter(provider(), heavyUsage, clock, 'h_someone'),
      new AiQuotaExceededError(5).message,
    )
  })
})
