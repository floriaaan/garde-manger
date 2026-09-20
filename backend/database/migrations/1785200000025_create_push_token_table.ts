import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per device that agreed to receive push notifications. The Expo push
 * token is the identity: signing in on a device with another account moves the
 * row to that account. `last_digest_on` makes the daily digest idempotent, so a
 * restart or a second instance never sends it twice (cf. docs/adr/0018).
 */
export default class extends BaseSchema {
  protected tableName = 'push_token'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary()
      table.text('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('token').notNullable().unique()
      table.text('platform').notNullable().checkIn(['ios', 'android'])
      table.date('last_digest_on').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['user_id'], 'push_token_user_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
