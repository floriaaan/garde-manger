import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('expiry_reminder_setting', (table) => {
      table.text('household_id').primary().references('id').inTable('household').onDelete('CASCADE')
      table.integer('days').notNullable()
      table.check('days in (0, 1, 2, 3, 7)', undefined, 'expiry_reminder_days_check')
    })
  }

  async down() {
    this.schema.dropTable('expiry_reminder_setting')
  }
}
