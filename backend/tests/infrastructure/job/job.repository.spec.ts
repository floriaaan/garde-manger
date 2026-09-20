import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidJobRepository } from '#infrastructure/database/job/job.repository'
import { Job } from '#domain/job/job.aggregate'

async function createHousehold(id: string) {
  const userId = `u_${id}`
  await db.table('user').insert({
    id: userId,
    name: userId,
    email: `${userId}@example.com`,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  })
  await db.table('household').insert({
    id,
    name: 'Test household',
    owner_id: userId,
    invite_code: id.slice(0, 8).toUpperCase().padEnd(8, '0'),
    created_at: new Date(),
    updated_at: new Date(),
  })
  return userId
}

function newJob(id: string, householdId: string, createdBy: string, now: Date) {
  return Job.create({
    id,
    householdId,
    createdBy,
    kind: 'recipe_generation',
    input: {},
    total: 1,
    traceparent: null,
    now,
  })
}

test.group('LucidJobRepository.claimNext', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('claims the oldest due job and marks it running', async ({ assert }) => {
    const user = await createHousehold('h_1')
    const repository = new LucidJobRepository()
    const now = new Date('2026-09-20T10:00:00Z')
    await repository.save(newJob('j_old', 'h_1', user, new Date('2026-09-20T09:00:00Z')))
    const user2 = await createHousehold('h_2')
    await repository.save(newJob('j_new', 'h_2', user2, new Date('2026-09-20T09:30:00Z')))

    const claimed = await repository.claimNext(now)

    assert.equal(claimed?.id, 'j_old')
    assert.equal(claimed?.status, 'running')
    assert.equal(claimed?.attempts, 1)
    assert.deepEqual(claimed?.lockedAt, now)
  })

  test('returns null when nothing is due yet', async ({ assert }) => {
    const user = await createHousehold('h_1')
    const repository = new LucidJobRepository()
    await repository.save(newJob('j_future', 'h_1', user, new Date('2026-09-20T11:00:00Z')))

    assert.isNull(await repository.claimNext(new Date('2026-09-20T10:00:00Z')))
  })

  test('never runs two jobs of the same household at once', async ({ assert }) => {
    const user = await createHousehold('h_1')
    const repository = new LucidJobRepository()
    const now = new Date('2026-09-20T10:00:00Z')
    await repository.save(newJob('j_1', 'h_1', user, new Date('2026-09-20T09:00:00Z')))
    await repository.save(newJob('j_2', 'h_1', user, new Date('2026-09-20T09:01:00Z')))

    const got1 = await repository.claimNext(now)
    assert.equal(got1?.id, 'j_1')
    assert.isNull(await repository.claimNext(now))
  })

  test('another household is not blocked by a running job', async ({ assert }) => {
    const userA = await createHousehold('h_1')
    const userB = await createHousehold('h_2')
    const repository = new LucidJobRepository()
    const now = new Date('2026-09-20T10:00:00Z')
    await repository.save(newJob('j_a', 'h_1', userA, new Date('2026-09-20T09:00:00Z')))
    await repository.save(newJob('j_b', 'h_2', userB, new Date('2026-09-20T09:01:00Z')))

    const got2 = await repository.claimNext(now)
    assert.equal(got2?.id, 'j_a')
    const got3 = await repository.claimNext(now)
    assert.equal(got3?.id, 'j_b')
  })

  test('requeueExpiredLeases() frees a job whose worker died, and only that one', async ({
    assert,
  }) => {
    const user = await createHousehold('h_1')
    const repository = new LucidJobRepository()
    await repository.save(newJob('j_1', 'h_1', user, new Date('2026-09-20T09:00:00Z')))
    await repository.claimNext(new Date('2026-09-20T09:00:00Z'))

    const early = await repository.requeueExpiredLeases(
      new Date('2026-09-20T08:00:00Z'),
      new Date('2026-09-20T10:00:00Z'),
    )
    assert.equal(early, 0)

    const requeued = await repository.requeueExpiredLeases(
      new Date('2026-09-20T09:30:00Z'),
      new Date('2026-09-20T10:00:00Z'),
    )
    assert.equal(requeued, 1)
    const got4 = await repository.findById('j_1')
    assert.equal(got4?.status, 'queued')
    const got5 = await repository.claimNext(new Date('2026-09-20T10:00:00Z'))
    assert.equal(got5?.id, 'j_1')
  })

  test('saveWithDraft() writes the job and its draft together, or neither', async ({ assert }) => {
    const user = await createHousehold('h_1')
    const repository = new LucidJobRepository()
    const job = newJob('j_1', 'h_1', user, new Date('2026-09-20T09:00:00Z'))
    job.succeed({ draftId: 'd_1' }, new Date('2026-09-20T09:01:00Z'))
    const draft = {
      id: 'd_1',
      householdId: 'h_1',
      jobId: 'missing_job_fk',
      kind: 'fridge' as const,
      status: 'pending' as const,
      payload: { items: [] },
      imageKeys: [],
      expiresAt: new Date('2026-09-22T09:00:00Z'),
      createdAt: new Date('2026-09-20T09:01:00Z'),
    }

    await assert.rejects(() => repository.saveWithDraft(job, draft))
    assert.isNull(await repository.findById('j_1'))

    await repository.saveWithDraft(job, { ...draft, jobId: 'j_1' })
    const got6 = await repository.findById('j_1')
    assert.equal(got6?.status, 'succeeded')
    const rows = await db.from('scan_draft').where('id', 'd_1')
    assert.lengthOf(rows, 1)
  })
})
