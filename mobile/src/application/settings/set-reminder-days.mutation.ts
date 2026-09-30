import { defineMutation } from '../shared/define-mutation.js'
import type { ReminderDays } from '../../domain/settings/reminder-settings.js'

export const useSetReminderDaysMutation = defineMutation((connector, days: ReminderDays) =>
  connector.setReminderDays(days))
