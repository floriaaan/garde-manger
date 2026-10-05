import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('expiry_reminder_setting', (table) => {
      table.boolean('enabled').notNullable().defaultTo(true)
      table.boolean('checkup_enabled').notNullable().defaultTo(true)
      table.integer('checkup_day').notNullable().defaultTo(1)
      table.check('checkup_day between 0 and 6', undefined, 'checkup_day_check')
    })
  }

  async down() {
    this.schema.alterTable('expiry_reminder_setting', (table) => {
      table.dropChecks('checkup_day_check')
      table.dropColumns('enabled', 'checkup_enabled', 'checkup_day')
    })
  }
}
