import { test } from '@japa/runner'
import { NotifyJobFinished } from '#application/push/notify-job-finished.use-case'
import { SendExpiryDigest } from '#application/push/send-expiry-digest.use-case'
import { Job } from '#domain/job/job.aggregate'
import type { PushMessage, PushSender } from '#domain/push/interfaces/push-sender.interface'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { DigestTarget } from '#domain/push/push-token'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'

class FakeSender implements PushSender {
  sent: PushMessage[] = []
  constructor(private readonly invalid: string[] = []) {}
  async send(messages: PushMessage[]) {
    this.sent.push(...messages)
    return { invalidTokens: this.invalid }
  }
}

class FakeTokens implements PushTokenRepository {
  deleted: string[] = []
  digested: string[] = []
  constructor(
    private readonly userTokens: string[],
    private readonly due: DigestTarget[] = [],
  ) {}
  async upsert() {}
  async deleteForUser() {}
  async deleteMany(tokens: string[]) {
    this.deleted.push(...tokens)
  }
  async listForUser() {
    return this.userTokens
  }
  async listDigestDue() {
    return this.due
  }
  async markDigested(tokens: string[]) {
    this.digested.push(...tokens)
  }
}

const products = (byHousehold: Record<string, string[]>) =>
  ({
    findExpiringSoon: async (householdId: string) =>
      (byHousehold[householdId] ?? []).map((name) => ({ name })),
  }) as unknown as ProductRepository

const now = new Date('2026-09-20T10:00:00Z')
const newJob = () =>
  Job.create({
    id: 'j1',
    householdId: 'h1',
    createdBy: 'u1',
    kind: 'fridge_scan',
    input: { imageKeys: ['a'] },
    total: 1,
    traceparent: null,
    now,
  })

test.group('NotifyJobFinished', () => {
  test('does nothing while the job is not terminal', async ({ assert }) => {
    const sender = new FakeSender()
    await new NotifyJobFinished(new FakeTokens(['t1']), sender).execute(newJob())
    assert.lengthOf(sender.sent, 0)
  })

  test('pushes to every device of the creator once the job succeeded', async ({ assert }) => {
    const job = newJob()
    job.succeed({ draftId: 'd1' }, now)
    const sender = new FakeSender()
    await new NotifyJobFinished(new FakeTokens(['t1', 't2']), sender).execute(job)
    assert.deepEqual(
      sender.sent.map((message) => message.to),
      ['t1', 't2'],
    )
    assert.equal(sender.sent[0]!.data?.route, '/tasks')
  })

  test('drops tokens the provider reports as dead', async ({ assert }) => {
    const job = newJob()
    job.succeed({ draftId: 'd1' }, now)
    const tokens = new FakeTokens(['t1'])
    await new NotifyJobFinished(tokens, new FakeSender(['t1'])).execute(job)
    assert.deepEqual(tokens.deleted, ['t1'])
  })
})

test.group('SendExpiryDigest', () => {
  const due: DigestTarget[] = [
    { token: 't1', userId: 'u1', householdId: 'h1' },
    { token: 't2', userId: 'u2', householdId: 'h2' },
  ]

  test('sends only to households with expiring products, and marks everyone served', async ({
    assert,
  }) => {
    const sender = new FakeSender()
    const tokens = new FakeTokens([], due)
    const result = await new SendExpiryDigest(
      tokens,
      products({ h1: ['Lait', 'Yaourt', 'Beurre', 'Œufs'] }),
      sender,
    ).execute({ today: '2026-09-20' })

    assert.equal(result.sent, 1)
    assert.equal(sender.sent[0]!.to, 't1')
    assert.equal(sender.sent[0]!.title, '4 produits expirent bientôt')
    assert.equal(sender.sent[0]!.body, 'Lait, Yaourt, Beurre et 1 autre')
    assert.sameMembers(tokens.digested, ['t1', 't2'])
  })

  test('is a no-op when every device was already served', async ({ assert }) => {
    const sender = new FakeSender()
    const result = await new SendExpiryDigest(new FakeTokens([], []), products({}), sender).execute(
      { today: '2026-09-20' },
    )
    assert.equal(result.sent, 0)
    assert.lengthOf(sender.sent, 0)
  })
})
