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
