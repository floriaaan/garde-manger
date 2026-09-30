import { test } from '@japa/runner'
import { NotifyJobFinished } from '#application/push/notify-job-finished.use-case'
import { SendExpiryDigest } from '#application/push/send-expiry-digest.use-case'
import { Job } from '#domain/job/job.aggregate'
import type { PushMessage, PushSender } from '#domain/push/interfaces/push-sender.interface'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { DigestTarget } from '#domain/push/push-token'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { ReminderSettingsRepository } from '#domain/push/reminder-settings'
import type { WebPushSender } from '#domain/push/interfaces/web-push-sender.interface'

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
  async upsertWeb() {}
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
  async claimDigest(targets: DigestTarget[]) {
    this.digested.push(...targets.map((target) => target.token))
    return targets
  }
}

const products = (
  byHousehold: Record<string, string[]>,
  onQuery?: (householdId: string, today: string, days: number) => void,
) =>
  ({
    findExpiringForDigest: async (householdId: string, today: string, days: number) => {
      onQuery?.(householdId, today, days)
      return (byHousehold[householdId] ?? []).map((name) => ({ name }))
    },
  }) as unknown as ProductRepository

const settings = (days = 2): ReminderSettingsRepository => ({
  getDays: async () => days as 0 | 1 | 2 | 3 | 7,
  setDays: async () => {},
})

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
    assert.equal(sender.sent[0]!.title, 'Frigo exploré 📸')
    assert.equal(
      sender.sent[0]!.body,
      'J’ai repéré des produits. Vérifie ma récolte avant de les ranger.',
    )
  })

  test('drops tokens the provider reports as dead', async ({ assert }) => {
    const job = newJob()
    job.succeed({ draftId: 'd1' }, now)
    const tokens = new FakeTokens(['t1'])
    await new NotifyJobFinished(tokens, new FakeSender(['t1'])).execute(job)
    assert.deepEqual(tokens.deleted, ['t1'])
  })

  test('keeps a retry path clear when a task fails', async ({ assert }) => {
    const job = newJob()
    job.fail('provider_not_configured', now)
    const sender = new FakeSender()
    await new NotifyJobFinished(new FakeTokens(['t1']), sender).execute(job)
    assert.equal(sender.sent[0]!.title, 'Le frigo m’a échappé 📸')
    assert.equal(sender.sent[0]!.body, 'Je n’ai pas terminé le scan. Retente depuis les tâches.')
  })
})

test.group('SendExpiryDigest', () => {
  const due: DigestTarget[] = [
    { token: 't1', userId: 'u1', householdId: 'h1', platform: 'ios' },
    { token: 't2', userId: 'u2', householdId: 'h2', platform: 'android' },
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
      settings(),
    ).execute({ today: '2026-09-20' })

    assert.equal(result.sent, 1)
    assert.equal(sender.sent[0]!.to, 't1')
    assert.equal(sender.sent[0]!.title, '4 produits à sauver 🥕')
    assert.equal(
      sender.sent[0]!.body,
      'Lait, Yaourt, Beurre et 1 autre approchent de leur date. À cuisiner bientôt !',
    )
    assert.sameMembers(tokens.digested, ['t1', 't2'])
  })

  test('is a no-op when every device was already served', async ({ assert }) => {
    const sender = new FakeSender()
    const result = await new SendExpiryDigest(
      new FakeTokens([], []),
      products({}),
      sender,
      settings(),
    ).execute({ today: '2026-09-20' })
    assert.equal(result.sent, 0)
    assert.lengthOf(sender.sent, 0)
  })

  test('uses singular copy for one product', async ({ assert }) => {
    const sender = new FakeSender()
    await new SendExpiryDigest(
      new FakeTokens([], [due[0]!]),
      products({ h1: ['Lait'] }),
      sender,
      settings(),
    ).execute({ today: '2026-09-20' })
    assert.equal(sender.sent[0]!.title, 'Un produit à sauver 🥕')
    assert.equal(sender.sent[0]!.body, 'Lait approche de sa date. Une idée de repas ?')
  })

  test('uses the chosen household window and sends web subscriptions through VAPID', async ({
    assert,
  }) => {
    const calls: string[] = []
    const web: WebPushSender = {
      send: async (messages) => {
        calls.push(...messages.map((message) => `${message.to}:${message.keys.p256dh}`))
        return { invalidTokens: [] }
      },
    }
    const sender = new FakeSender()
    const tokens = new FakeTokens(
      [],
      [
        {
          token: 'https://web.push.apple.com/x',
          userId: 'u1',
          householdId: 'h1',
          platform: 'web',
          keys: { p256dh: 'key', auth: 'secret' },
        },
      ],
    )
    const queried: string[] = []
    const result = await new SendExpiryDigest(
      tokens,
      products({ h1: ['Lait'] }, (householdId, today, days) =>
        queried.push(`${householdId}:${today}:${days}`),
      ),
      sender,
      settings(7),
      web,
    ).execute({ today: '2026-09-20' })
    assert.deepEqual(queried, ['h1:2026-09-20:7'])
    assert.deepEqual(calls, ['https://web.push.apple.com/x:key'])
    assert.lengthOf(sender.sent, 0)
    assert.equal(result.sent, 1)
  })
})
