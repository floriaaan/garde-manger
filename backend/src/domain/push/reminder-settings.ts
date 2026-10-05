export const REMINDER_DAYS = [0, 1, 2, 3, 7] as const
export type ReminderDays = (typeof REMINDER_DAYS)[number]
export const DEFAULT_REMINDER_DAYS: ReminderDays = 2

export interface NotificationPreferences {
  enabled: boolean
  checkupEnabled: boolean
  /** Day of the week, Sunday = 0. */
  checkupDay: number
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  checkupEnabled: true,
  checkupDay: 1,
}

export interface ReminderSettingsRepository {
  getPreferences(householdId: string): Promise<NotificationPreferences>
  setPreferences(householdId: string, preferences: Partial<NotificationPreferences>): Promise<void>
  getDays(householdId: string): Promise<ReminderDays>
  setDays(householdId: string, days: ReminderDays): Promise<void>
}
