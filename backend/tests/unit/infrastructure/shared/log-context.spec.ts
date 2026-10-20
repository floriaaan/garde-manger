import { test } from '@japa/runner'
import { logContext } from '#infrastructure/shared/log-context'

test('concurrent jobs retain their own context across awaits and restore the caller', async ({
  assert,
}) => {
  let release!: () => void
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  const first = logContext.run({ householdId: 'first' }, async () => {
    await barrier
    return logContext.current().householdId
  })
  const second = logContext.run({ householdId: 'second' }, async () => {
    release()
    await Promise.resolve()
    return logContext.current().householdId
  })
  assert.deepEqual(await Promise.all([first, second]), ['first', 'second'])
  assert.deepEqual(logContext.current(), {})
})
