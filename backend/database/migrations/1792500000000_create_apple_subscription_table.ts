import { BaseSchema } from '@adonisjs/lucid/schema'

/** Additive: Stripe rows and all existing clients keep working during rollout. */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('apple_subscription', (table) => {
      table.text('id').primary() // environment + original transaction id
      table.text('original_transaction_id').notNullable()
      table.text('environment').notNullable().checkIn(['Production', 'Sandbox'])
      table.text('payer_user_id').nullable().references('id').inTable('user').onDelete('SET NULL').index()
      table.text('household_id').nullable().references('id').inTable('household').onDelete('SET NULL').index()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.boolean('cancel_at_period_end').notNullable()
      table.timestamp('signed_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable('apple_subscription')
  }
}
