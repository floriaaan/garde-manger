import db from '@adonisjs/lucid/services/db'
import {
  DEFAULT_REMINDER_DAYS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type ReminderDays,
  type ReminderSettingsRepository,
} from '#domain/push/reminder-settings'

export class LucidReminderSettingsRepository implements ReminderSettingsRepository {
  async getPreferences(householdId: string): Promise<NotificationPreferences> {
    const row = await db.from('expiry_reminder_setting').where('household_id', householdId).first()
    return row
      ? {
          enabled: row.enabled,
          checkupEnabled: row.checkup_enabled,
          checkupDay: row.checkup_day,
        }
      : { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }

  async setPreferences(
    householdId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<void> {
    const changes = {
      ...(preferences.enabled !== undefined ? { enabled: preferences.enabled } : {}),
      ...(preferences.checkupEnabled !== undefined
        ? { checkup_enabled: preferences.checkupEnabled }
        : {}),
      ...(preferences.checkupDay !== undefined ? { checkup_day: preferences.checkupDay } : {}),
    }
    if (Object.keys(changes).length === 0) return
    await db
      .table('expiry_reminder_setting')
      .insert({ household_id: householdId, days: DEFAULT_REMINDER_DAYS, ...changes })
      .onConflict('household_id')
      .merge(changes)
  }

  async getDays(householdId: string): Promise<ReminderDays> {
    const row = await db.from('expiry_reminder_setting').where('household_id', householdId).first()
    return (row?.days ?? DEFAULT_REMINDER_DAYS) as ReminderDays
  }

  async setDays(householdId: string, days: ReminderDays): Promise<void> {
    await db
      .table('expiry_reminder_setting')
      .insert({ household_id: householdId, days })
      .onConflict('household_id')
      .merge({ days })
  }
}
