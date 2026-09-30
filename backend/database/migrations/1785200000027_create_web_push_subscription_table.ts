import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('web_push_subscription', (table) => {
      table.text('id').primary()
      table.text('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('endpoint').notNullable().unique()
      table.text('p256dh').notNullable()
      table.text('auth').notNullable()
      table.date('last_digest_on').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.alterTable('web_push_subscription', (table) => table.index('user_id'))
  }

  async down() {
    this.schema.dropTable('web_push_subscription')
  }
}
