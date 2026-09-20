import { test } from '@japa/runner'
import {
  resolveReceiptExtractionAdapter,
  resolveRecipeGenerationAdapter,
} from '#infrastructure/settings/ai-provider-registry'
import { GeminiReceiptExtractionAdapter } from '#infrastructure/settings/gemini-receipt-extraction.adapter'
import { OllamaReceiptExtractionAdapter } from '#infrastructure/settings/ollama-receipt-extraction.adapter'
import { GeminiRecipeGenerationAdapter } from '#infrastructure/settings/gemini-recipe-generation.adapter'
import { OllamaRecipeGenerationAdapter } from '#infrastructure/settings/ollama-recipe-generation.adapter'
import { AiQuotaExceededError } from '#domain/settings/ai-quota-exceeded.error'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiQuotaPort } from '#domain/settings/interfaces/ai-quota-port.interface'
import type { AiAccess } from '#domain/settings/ai-access'
import type { AiProvider } from '#domain/settings/ai-provider.vo'
import type { Clock } from '#domain/shared/clock.interface'

const fixedClock: Clock = { now: () => new Date('2026-09-18T10:00:00Z') }

function fakeSettings(
  provider: AiProvider,
  overrides: { availableProviders?: AiProvider[]; access?: Partial<AiAccess> } = {},
): AiSettingsProvider {
  return {
    async resolveEffective() {
      return {
        activeProvider: provider,
        source: 'environment',
        availableProviders: overrides.availableProviders ?? [provider],
        canChooseProvider: true,
        models: { vision: '', text: '' },
        access: {
          plan: 'self-hosted',
          used: 0,
          limit: null,
          resetsAt: null,
          expiresAt: null,
          cancelsAtPeriodEnd: false,
          ...overrides.access,
        },
      }
    },
  }
}

function fakeQuota(): AiQuotaPort & { recordedFor: string[] } {
  const recordedFor: string[] = []
  return {
    recordedFor,
    async usage() {
      return { used: 0, limit: null, resetsAt: null }
    },
    async record(householdId: string) {
      recordedFor.push(householdId)
    },
  }
}

test.group('resolveReceiptExtractionAdapter (ai-provider-registry)', () => {
  test('returns the same adapter instance when the provider is unchanged (self-hosted)', async ({
    assert,
  }) => {
    const settings = fakeSettings('gemini')
    const first = await resolveReceiptExtractionAdapter(settings, fakeQuota(), fixedClock, 'h_1')
    const second = await resolveReceiptExtractionAdapter(settings, fakeQuota(), fixedClock, 'h_1')
    assert.strictEqual(first, second)
    assert.instanceOf(first, GeminiReceiptExtractionAdapter)
  })

  test('rebuilds the adapter when the provider changes', async ({ assert }) => {
    await resolveReceiptExtractionAdapter(fakeSettings('gemini'), fakeQuota(), fixedClock, 'h_1')
    const afterSwitch = await resolveReceiptExtractionAdapter(
      fakeSettings('ollama'),
      fakeQuota(),
      fixedClock,
      'h_1',
    )
    assert.instanceOf(afterSwitch, OllamaReceiptExtractionAdapter)
  })

  test('refuses a provider whose credentials are gone', async ({ assert }) => {
    const settings = fakeSettings('openai', { availableProviders: [] })
    await assert.rejects(
      () => resolveReceiptExtractionAdapter(settings, fakeQuota(), fixedClock, 'h_1'),
      new ReceiptExtractionUnavailableError('openai').message,
    )
  })

  test('refuses a household that has used up its monthly quota', async ({ assert }) => {
    const settings = fakeSettings('gemini', { access: { plan: 'free', limit: 5, used: 5 } })
    await assert.rejects(
      () => resolveReceiptExtractionAdapter(settings, fakeQuota(), fixedClock, 'h_1'),
      new AiQuotaExceededError(5).message,
    )
  })

  test('records usage after a successful hosted call, not before', async ({ assert }) => {
    const original = GeminiReceiptExtractionAdapter.prototype.extract
    GeminiReceiptExtractionAdapter.prototype.extract = async () =>
      ({}) as Awaited<ReturnType<typeof original>>
    try {
      const settings = fakeSettings('gemini', { access: { plan: 'free', limit: 5, used: 2 } })
      const quota = fakeQuota()
      const adapter = await resolveReceiptExtractionAdapter(settings, quota, fixedClock, 'h_1')
      assert.deepEqual(quota.recordedFor, [])
      await adapter.extract(Buffer.from(''))
      assert.deepEqual(quota.recordedFor, ['h_1'])
    } finally {
      GeminiReceiptExtractionAdapter.prototype.extract = original
    }
  })

  test('does not record usage on self-hosted (uncapped) instances', async ({ assert }) => {
    const original = GeminiReceiptExtractionAdapter.prototype.extract
    GeminiReceiptExtractionAdapter.prototype.extract = async () =>
      ({}) as Awaited<ReturnType<typeof original>>
    try {
      const settings = fakeSettings('gemini')
      const quota = fakeQuota()
      const adapter = await resolveReceiptExtractionAdapter(settings, quota, fixedClock, 'h_1')
      await adapter.extract(Buffer.from(''))
      assert.deepEqual(quota.recordedFor, [])
    } finally {
      GeminiReceiptExtractionAdapter.prototype.extract = original
    }
  })
})

test.group('resolveRecipeGenerationAdapter (ai-provider-registry)', () => {
  test('returns the same adapter instance when the provider is unchanged (self-hosted)', async ({
    assert,
  }) => {
    const settings = fakeSettings('gemini')
    const first = await resolveRecipeGenerationAdapter(settings, fakeQuota(), fixedClock, 'h_1')
    const second = await resolveRecipeGenerationAdapter(settings, fakeQuota(), fixedClock, 'h_1')
    assert.strictEqual(first, second)
    assert.instanceOf(first, GeminiRecipeGenerationAdapter)
  })

  test('rebuilds the adapter when the provider changes', async ({ assert }) => {
    await resolveRecipeGenerationAdapter(fakeSettings('gemini'), fakeQuota(), fixedClock, 'h_1')
    const afterSwitch = await resolveRecipeGenerationAdapter(
      fakeSettings('ollama'),
      fakeQuota(),
      fixedClock,
      'h_1',
    )
    assert.instanceOf(afterSwitch, OllamaRecipeGenerationAdapter)
  })
})
