import { defineMutation } from '../shared/define-mutation.js'
import type { ReminderSettingsUpdate } from '../../domain/settings/reminder-settings.js'

export const useSetReminderSettingsMutation = defineMutation((connector, update: ReminderSettingsUpdate) =>
  connector.setReminderSettings(update))
