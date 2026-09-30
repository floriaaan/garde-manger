export const REMINDER_DAYS = [0, 1, 2, 3, 7] as const
export type ReminderDays = (typeof REMINDER_DAYS)[number]
export const DEFAULT_REMINDER_DAYS: ReminderDays = 2

export interface ReminderSettings {
  days: ReminderDays
  hour: number
  timeZone: string
}

export interface WebPushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
