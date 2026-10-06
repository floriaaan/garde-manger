import { resolveFridgeScanExtractionAdapter } from '#infrastructure/settings/ai-provider-registry'
import { GeminiFridgeScanExtractionAdapter } from '#infrastructure/settings/gemini-fridge-scan-extraction.adapter'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiQuotaPort } from '#domain/settings/interfaces/ai-quota-port.interface'
import { test } from '@japa/runner'
import { RunJob } from '#application/job/run-job.use-case'
import type { RunJobDeps } from '#application/job/run-job.use-case'
import { Job } from '#domain/job/job.aggregate'
import type { ScanDraft } from '#domain/job/scan-draft'
import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'
import { AiQuotaExceededError } from '#domain/settings/ai-quota-exceeded.error'
import { ReceiptExtractionParseError } from '#domain/receipt/receipt-extraction.errors'

const now = new Date('2026-09-20T10:00:00Z')

function fridgeJob(keys: string[]) {
  return Job.create({
    id: 'j1',
    householdId: 'h1',
    createdBy: 'u1',
    kind: 'fridge_scan',
    input: { imageKeys: keys },
    total: keys.length,
    traceparent: null,
    now,
  })
}

const item = (name: string, quantity = 1) => ({
  name,
  quantity,
  unit: 'pièce',
  category: null,
  location: 'fridge' as const,
  expiresInDays: null,
})

/** `extract` outcomes are consumed in order, one per photo. */
function setup(outcomes: (FridgeScanDraft | Error)[], overrides: Partial<RunJobDeps> = {}) {
  const saved: ScanDraft[] = []
  let jobSaves = 0
  const queue = [...outcomes]
  const deps = {
    jobs: {
      save: async () => {
        jobSaves++
      },
      saveWithDraft: async (_job: Job, draft: ScanDraft) => {
        saved.push(draft)
      },
    },
    drafts: { findById: async () => null },
    storage: { read: async () => ({ buffer: Buffer.from('x'), contentType: 'image/png' }) },
    recipes: {},
    products: {},
    idGenerator: { next: () => 'draft-1' },
    clock: { now: () => now },
    resolveReceiptExtraction: async () => ({
      extract: async () => {
        throw new ReceiptExtractionParseError('bad')
      },
    }),
    resolveFridgeScanExtraction: async () => ({
      extract: async () => {
        const next = queue.shift()!
        if (next instanceof Error) throw next
        return next
      },
    }),
    resolveRecipeGeneration: async () => ({ generate: async () => [] }),
    unitTimeoutMs: 1_000,
    draftTtlHours: 48,
    ...overrides,
  } as unknown as RunJobDeps
  return { run: new RunJob(deps), saved, jobSaves: () => jobSaves }
}

test.group('RunJob: fridge scan', () => {
  test('merges every photo into one draft and succeeds', async ({ assert }) => {
    const { run, saved } = setup([
      { items: [item('Lait', 1)] },
      { items: [item('Lait', 3), item('Oeufs')] },
    ])
    const job = fridgeJob(['a', 'b'])
    await run.execute(job)

    assert.equal(job.status, 'succeeded')
    assert.deepEqual(job.progress, { total: 2, done: 2, failed: [] })
    assert.equal(job.result?.draftId, 'draft-1')
    assert.lengthOf(saved, 1)
    assert.lengthOf((saved[0]!.payload as FridgeScanDraft).items, 2)
  })

  test('partial success still yields a draft and records the failed photo', async ({ assert }) => {
    const { run, saved } = setup([
      { items: [item('Lait')] },
      new ReceiptExtractionParseError('bad'),
    ])
    const job = fridgeJob(['a', 'b'])
    await run.execute(job)

    assert.equal(job.status, 'succeeded')
    assert.deepEqual(job.progress, { total: 2, done: 1, failed: [1] })
    assert.lengthOf(saved, 1)
  })

  test('an unexpected throw re-queues the job instead of losing it', async ({ assert }) => {
    const { run, saved } = setup([new Error('db hiccup')])
    const job = fridgeJob(['a'])
    await run.execute(job)

    assert.equal(job.status, 'queued')
    assert.lengthOf(saved, 0)
  })

  test('a spent quota stops the remaining photos and fails the job at once', async ({ assert }) => {
    let calls = 0
    const { run } = setup([], {
      resolveFridgeScanExtraction: async () => {
        calls++
        throw new AiQuotaExceededError(50)
      },
    })
    const job = Job.reconstruct({ ...propsOf(fridgeJob(['a', 'b', 'c'])), attempts: 1 })
    await run.execute(job)

    assert.equal(job.status, 'failed')
    assert.equal(job.errorType, 'ai_quota_exceeded')
    assert.equal(calls, 1)
  })

  test('a unit exceeding the timeout counts as an extraction failure', async ({ assert }) => {
    const { run } = setup([], {
      unitTimeoutMs: 10,
      resolveFridgeScanExtraction: async () => ({ extract: () => new Promise(() => {}) }),
    } as Partial<RunJobDeps>)
    const job = Job.reconstruct({ ...propsOf(fridgeJob(['a'])), attempts: 3 })
    await run.execute(job)

    assert.equal(job.status, 'failed')
    assert.equal(job.errorType, 'extraction_failed')
  })
})

function propsOf(job: Job) {
  return {
    id: job.id,
    householdId: job.householdId,
    createdBy: job.createdBy,
    kind: job.kind,
    status: job.status,
    input: job.input,
    progress: job.progress,
    result: job.result,
    errorType: job.errorType,
    attempts: job.attempts,
    runAt: job.runAt,
    lockedAt: job.lockedAt,
    dismissedAt: job.dismissedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    traceparent: job.traceparent,
    createdAt: job.createdAt,
  }
}

test('one hosted fridge scan uses one quota unit across all photos and partial retries', async ({
  assert,
}) => {
  let used = 0
  let calls = 0
  const languages: (string | undefined)[] = []
  let existing: ScanDraft | null = null
  const settings: AiSettingsProvider = {
    async resolveEffective() {
      return {
        activeProvider: 'gemini',
        source: 'environment',
        availableProviders: ['gemini'],
        canChooseProvider: true,
        models: { vision: '', text: '' },
        access: {
          plan: 'free',
          used,
          limit: 1,
          resetsAt: null,
          expiresAt: null,
          cancelsAtPeriodEnd: false,
        },
      }
    },
  }
  const quota: AiQuotaPort = {
    async usage() {
      return { used, limit: 1, resetsAt: null }
    },
    async record() {
      used++
    },
  }
  const original = GeminiFridgeScanExtractionAdapter.prototype.extract
  GeminiFridgeScanExtractionAdapter.prototype.extract = async (_image, language) => {
    languages.push(language)
    calls++
    if (calls === 1) throw new ReceiptExtractionParseError('bad first photo')
    return { items: [item(`Produit ${calls}`)] }
  }
  try {
    const { run, saved } = setup([], {
      drafts: { findById: async () => existing } as unknown as RunJobDeps['drafts'],
      resolveFridgeScanExtraction: (householdId, recorded) =>
        resolveFridgeScanExtractionAdapter(
          settings,
          quota,
          { now: () => now },
          householdId,
          recorded,
        ),
    })
    const job = fridgeJob(['a', 'b', 'c'])
    job.input.language = 'en'
    await run.execute(job)
    assert.equal(job.status, 'succeeded')
    assert.deepEqual(job.progress, { total: 3, done: 2, failed: [0] })
    assert.equal(used, 1)
    existing = saved[0]!
    job.requeue(now)
    await run.execute(job)
    assert.deepEqual(job.progress, { total: 3, done: 3, failed: [] })
    assert.equal(used, 1)
    assert.equal(calls, 4)
    assert.deepEqual(languages, ['en', 'en', 'en', 'en'])
    // A separate scan still needs an available quota unit.
    const next = fridgeJob(['d'])
    await run.execute(next)
    assert.equal(next.status, 'failed')
    assert.equal(next.errorType, 'ai_quota_exceeded')
    assert.equal(calls, 4)
  } finally {
    GeminiFridgeScanExtractionAdapter.prototype.extract = original
  }
})

test('a full retry after an unexpected error remembers the scan already counted', async ({
  assert,
}) => {
  let calls = 0
  let charged = 0
  const languages: (string | undefined)[] = []
  const { run } = setup([], {
    resolveFridgeScanExtraction: async (_householdId, recorded) => ({
      async extract(_image, language) {
        languages.push(language)
        calls++
        if (calls === 2) throw new Error('temporary failure')
        if (!recorded) charged++
        return { items: [item('Lait')] }
      },
    }),
  })
  const job = fridgeJob(['a', 'b'])
  job.input.language = 'en'
  await run.execute(job)
  assert.equal(job.status, 'queued')
  assert.isNull(job.result)
  assert.equal(charged, 1)
  // Reconstruct as on the next worker run: progress resets, the persisted input does not.
  const retry = Job.reconstruct(propsOf(job))
  await run.execute(retry)
  assert.equal(retry.status, 'succeeded')
  assert.equal(charged, 1)
  assert.equal(calls, 4)
  assert.deepEqual(languages, ['en', 'en', 'en', 'en'])
})

test.group('RunJob: requesting user language', () => {
  for (const kind of ['receipt_scan', 'fridge_scan', 'recipe_generation'] as const) {
    for (const language of ['en', 'fr', undefined] as const) {
      test(`${kind} forwards ${language ?? 'legacy French'} to the provider`, async ({
        assert,
      }) => {
        const received: (string | undefined)[] = []
        const { run } = setup([], {
          products: { findByHousehold: async () => [] } as unknown as RunJobDeps['products'],
          resolveRecipeGeneration: async () => ({
            generate: async (context) => {
              received.push(context.language)
              return []
            },
          }),
          resolveReceiptExtraction: async () => ({
            extract: async (_file, outputLanguage) => {
              received.push(outputLanguage)
              return { storeName: 'Monoprix', scannedAt: now, totalAmount: 0, items: [] }
            },
          }),
          resolveFridgeScanExtraction: async () => ({
            extract: async (_image, outputLanguage) => {
              received.push(outputLanguage)
              return { items: [item('Milk')] }
            },
          }),
        })
        const job = Job.create({
          id: 'localized-job',
          householdId: 'h1',
          createdBy: 'u1',
          kind,
          input: { imageKeys: ['photo'], language },
          total: 1,
          traceparent: null,
          now,
        })
        await run.execute(job)
        assert.equal(job.status, 'succeeded')
        assert.deepEqual(received, [language ?? 'fr'])
      })
    }
  }
})
