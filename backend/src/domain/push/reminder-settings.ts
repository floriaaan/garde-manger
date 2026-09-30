export const REMINDER_DAYS = [0, 1, 2, 3, 7] as const
export type ReminderDays = (typeof REMINDER_DAYS)[number]
export const DEFAULT_REMINDER_DAYS: ReminderDays = 2

export interface ReminderSettingsRepository {
  getDays(householdId: string): Promise<ReminderDays>
  setDays(householdId: string, days: ReminderDays): Promise<void>
}
