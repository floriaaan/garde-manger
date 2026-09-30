import db from '@adonisjs/lucid/services/db'
import {
  DEFAULT_REMINDER_DAYS,
  type ReminderDays,
  type ReminderSettingsRepository,
} from '#domain/push/reminder-settings'

export class LucidReminderSettingsRepository implements ReminderSettingsRepository {
  async getDays(householdId: string): Promise<ReminderDays> {
    const row = await db.from('expiry_reminder_setting').where('household_id', householdId).first()
    return (row?.days ?? DEFAULT_REMINDER_DAYS) as ReminderDays
  }

  async setDays(householdId: string, days: ReminderDays): Promise<void> {
    await db.table('expiry_reminder_setting').insert({ household_id: householdId, days })
      .onConflict('household_id').merge({ days })
  }
}
