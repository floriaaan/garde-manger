import { test } from '@japa/runner'
import { isFatal, MAX_ATTEMPTS, nextAttemptAt } from '#domain/job/retry-policy'

const now = new Date('2026-09-20T10:00:00Z')

test.group('retry policy', () => {
  test('backs off 10 s after the first attempt, 20 s after the second', ({ assert }) => {
    assert.equal(nextAttemptAt('extraction_failed', 1, now)?.getTime(), now.getTime() + 10_000)
    assert.equal(nextAttemptAt('extraction_failed', 2, now)?.getTime(), now.getTime() + 20_000)
  })

  test('gives up once the attempt budget is spent', ({ assert }) => {
    assert.isNull(nextAttemptAt('extraction_failed', MAX_ATTEMPTS, now))
  })

  test('never retries a missing provider or a spent quota', ({ assert }) => {
    assert.isNull(nextAttemptAt('provider_not_configured', 1, now))
    assert.isNull(nextAttemptAt('ai_quota_exceeded', 1, now))
    assert.isTrue(isFatal('ai_quota_exceeded'))
    assert.isFalse(isFatal('extraction_failed'))
  })
})
