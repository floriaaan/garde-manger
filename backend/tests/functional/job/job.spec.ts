import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { insertOrReplaceDraft } from '#infrastructure/database/job/scan-draft.repository'

// Minimal valid 1x1 PNG — uploads are validated on real content, not the extension.
const fakePngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII=',
  'base64',
)

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer jobs' })
  return cookie
}

async function enqueueReceipt(client: import('@japa/api-client').ApiClient, cookie: string) {
  return client
    .post('/api/jobs/receipt-scan')
    .headers({ cookie })
    .file('image', fakePngBytes, { filename: 'ticket.png' })
}

test.group('job: enqueue, read, retry, dismiss, drafts', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('enqueueing a receipt scan answers 202 with a queued job', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'job-enqueue@example.com')
    const response = await enqueueReceipt(client, cookie)
    response.assertStatus(202)
    response.assertBodyContains({
      job: { kind: 'receipt_scan', status: 'queued', progress: { total: 1, done: 0 } },
    })
    const list = await client.get('/api/jobs').headers({ cookie })
    assert.lengthOf(list.body().jobs, 1)
  })

  test('enqueueing without a file answers 422 and creates no job', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'job-nofile@example.com')
    const response = await client.post('/api/jobs/receipt-scan').headers({ cookie })
    response.assertStatus(422)
    const list = await client.get('/api/jobs').headers({ cookie })
    assert.lengthOf(list.body().jobs, 0)
  })

  test('a job of another household reads as not found', async ({ client }) => {
    const owner = await signUpWithHousehold(client, 'job-owner@example.com')
    const other = await signUpWithHousehold(client, 'job-other@example.com')
    const created = await enqueueReceipt(client, owner)
    const id = created.body().job.id

    const res1 = await client.get(`/api/jobs/${id}`).headers({ cookie: other })
    res1.assertStatus(404)
    const res2 = await client.post(`/api/jobs/${id}/retry`).headers({ cookie: other })
    res2.assertStatus(404)
    const res3 = await client.delete(`/api/jobs/${id}`).headers({ cookie: other })
    res3.assertStatus(404)
  })

  test('a queued job cannot be retried, and dismissing it removes it', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'job-dismiss@example.com')
    const queued = await enqueueReceipt(client, cookie)
    const id = queued.body().job.id

    const res4 = await client.post(`/api/jobs/${id}/retry`).headers({ cookie })
    res4.assertStatus(409)
    const res5 = await client.delete(`/api/jobs/${id}`).headers({ cookie })
    res5.assertStatus(204)
    assert.isNull(await db.from('ai_job').where('id', id).first())
  })

  test('dismissing a finished job hides it, dismissing it again deletes it', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'job-dismiss-twice@example.com')
    const id = (await enqueueReceipt(client, cookie)).body().job.id
    await db.from('ai_job').where('id', id).update({ status: 'failed', finished_at: new Date() })

    await client.delete(`/api/jobs/${id}`).headers({ cookie })
    const hidden = (await client.get('/api/jobs').headers({ cookie })).body().jobs
    assert.lengthOf(hidden, 1)
    assert.isNotNull(hidden[0].dismissedAt)

    const restored = await client.post(`/api/jobs/${id}/restore`).headers({ cookie })
    restored.assertStatus(204)
    const back = (await client.get('/api/jobs').headers({ cookie })).body().jobs
    assert.isNull(back[0].dismissedAt)

    await client.delete(`/api/jobs/${id}`).headers({ cookie })
    await client.delete(`/api/jobs/${id}`).headers({ cookie })
    assert.isNull(await db.from('ai_job').where('id', id).first())
  })

  test('import with an unknown draftId answers 404', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'job-draft-404@example.com')
    const response = await client
      .post('/api/receipts/import')
      .headers({ cookie })
      .json({
        draftId: 'nope',
        storeName: 'Carrefour',
        scannedAt: '2026-08-26T18:00:00Z',
        totalAmount: 4.8,
        items: [{ name: 'Lait', quantity: 1, unit: 'piece', location: 'fridge' }],
      })
    response.assertStatus(404)
  })

  test('importing a receipt from its draft keeps the photo and spends the draft', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'job-draft-import@example.com')
    const queuedJob = await enqueueReceipt(client, cookie)
    const jobId = queuedJob.body().job.id
    const job = await db.from('ai_job').where('id', jobId).firstOrFail()
    const now = new Date()
    await insertOrReplaceDraft({
      id: 'draft-1',
      householdId: job.household_id,
      jobId,
      kind: 'receipt',
      payload: { storeName: 'Carrefour', scannedAt: now, totalAmount: 4.8, items: [] },
      imageKeys: ['scan/x/y/0'],
      status: 'pending',
      expiresAt: new Date(now.getTime() + 3_600_000),
      createdAt: now,
    })

    const drafts = await client.get('/api/scan-drafts').headers({ cookie })
    assert.lengthOf(drafts.body().drafts, 1)

    const response = await client
      .post('/api/receipts/import')
      .headers({ cookie })
      .json({
        draftId: 'draft-1',
        storeName: 'Carrefour',
        scannedAt: now.toISOString(),
        totalAmount: 4.8,
        items: [{ name: 'Lait', quantity: 1, unit: 'piece', location: 'fridge' }],
      })
    response.assertStatus(201)
    response.assertBodyContains({ receipt: { imageKey: 'scan/x/y/0' } })

    const after = await client.get('/api/scan-drafts').headers({ cookie })
    assert.lengthOf(after.body().drafts, 0)
  })
})

test.group('push tokens', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('registers a token, re-registering is idempotent, unregistering removes it', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'push-token@example.com')
    const token = 'ExponentPushToken[abc]'
    const body = { token, platform: 'ios' }

    ;(await client.post('/api/push-tokens').headers({ cookie }).json(body)).assertStatus(204)
    ;(await client.post('/api/push-tokens').headers({ cookie }).json(body)).assertStatus(204)
    assert.lengthOf(await db.from('push_token').where('token', token), 1)

    ;(
      await client.delete('/api/push-tokens').headers({ cookie }).json({ token })
    ).assertStatus(204)
    assert.lengthOf(await db.from('push_token').where('token', token), 0)
  })

  test('rejects an unknown platform', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'push-bad@example.com')
    const response = await client
      .post('/api/push-tokens')
      .headers({ cookie })
      .json({ token: 'x', platform: 'web' })
    response.assertStatus(422)
  })
})
