import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import SeedReviewAccount from '../../../commands/seed_review_account.js'

const EMAIL = 'review@example.com'

async function seed() {
  const command = await ace.create(SeedReviewAccount, [])
  await command.exec()
  command.assertSucceeded()
}

async function count(table: string, householdId: string): Promise<number> {
  const [row] = await db.from(table).where('household_id', householdId).count('* as total')
  return Number(row.total)
}

test.group('seed:review-account', (group) => {
  group.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })
  group.each.setup(() => {
    env.set('REVIEW_ACCOUNT_EMAIL', EMAIL)
    env.set('REVIEW_ACCOUNT_PASSWORD', 'first-password-123')
    return () => {
      env.set('REVIEW_ACCOUNT_EMAIL', '')
      env.set('REVIEW_ACCOUNT_PASSWORD', '')
    }
  })

  test('is idempotent: one user, one household, the same content after a rerun', async ({
    assert,
    client,
  }) => {
    await seed()
    env.set('REVIEW_ACCOUNT_PASSWORD', 'second-password-456')
    await seed()

    const users = await db.from('user').where('email', EMAIL)
    assert.lengthOf(users, 1)
    const members = await db.from('household_member').where('user_id', users[0].id)
    assert.lengthOf(members, 1)
    const householdId = members[0].household_id

    assert.equal(await count('product', householdId), 21)
    assert.equal(await count('product_outcome', householdId), 8)
    assert.equal(await count('shopping_item', householdId), 5)

    // The rerun reset the password to the current env value.
    const signIn = await client
      .post('/api/auth/sign-in/email')
      .json({ email: EMAIL, password: 'second-password-456' })
    signIn.assertStatus(200)
  })

  test('refuses to run without credentials in the environment', async () => {
    env.set('REVIEW_ACCOUNT_PASSWORD', '')
    const command = await ace.create(SeedReviewAccount, [])
    await command.exec()
    command.assertFailed()
  })
})
