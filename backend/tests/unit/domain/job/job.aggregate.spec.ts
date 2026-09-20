import { test } from '@japa/runner'
import { Job } from '#domain/job/job.aggregate'

const now = new Date('2026-09-20T10:00:00Z')

function scanJob(total = 3) {
  return Job.create({
    id: 'j1',
    householdId: 'h1',
    createdBy: 'u1',
    kind: 'fridge_scan',
    input: { imageKeys: ['a', 'b', 'c'] },
    total,
    traceparent: null,
    now,
  })
}

test.group('Job', () => {
  test('starts queued with an empty progress', ({ assert }) => {
    const job = scanJob()
    assert.equal(job.status, 'queued')
    assert.deepEqual(job.progress, { total: 3, done: 0, failed: [] })
    assert.isTrue(job.active)
  })

  test('recordUnit tracks done and failed units; a re-run of a failed unit clears it', ({
    assert,
  }) => {
    const job = scanJob()
    job.recordUnit(0, true)
    job.recordUnit(2, false)
    assert.deepEqual(job.progress, { total: 3, done: 1, failed: [2] })
    job.recordUnit(2, true)
    assert.deepEqual(job.progress, { total: 3, done: 2, failed: [] })
  })

  test('fail re-queues with backoff, then fails for good once attempts run out', ({ assert }) => {
    const job = Job.reconstruct({ ...propsOf(scanJob()), attempts: 1 })
    job.fail('extraction_failed', now)
    assert.equal(job.status, 'queued')
    assert.equal(job.runAt.getTime(), now.getTime() + 10_000)

    const last = Job.reconstruct({ ...propsOf(scanJob()), attempts: 3 })
    last.fail('extraction_failed', now)
    assert.equal(last.status, 'failed')
    assert.equal(last.errorType, 'extraction_failed')
  })

  test('a quota error fails on the first attempt', ({ assert }) => {
    const job = Job.reconstruct({ ...propsOf(scanJob()), attempts: 1 })
    job.fail('ai_quota_exceeded', now)
    assert.equal(job.status, 'failed')
  })

  test('once a draft exists, only the failed units are pending and progress is kept', ({
    assert,
  }) => {
    const job = scanJob()
    job.recordUnit(0, true)
    job.recordUnit(1, false)
    job.succeed({ draftId: 'd1' }, now)
    job.requeue(now)
    assert.deepEqual(job.pendingUnits(), [1])
    job.beginRun()
    assert.equal(job.progress.done, 1)
  })

  test('without a draft, a new run replays every unit from zero', ({ assert }) => {
    const job = scanJob()
    job.recordUnit(0, true)
    job.beginRun()
    assert.deepEqual(job.progress, { total: 3, done: 0, failed: [] })
    assert.deepEqual(job.pendingUnits(), [0, 1, 2])
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
