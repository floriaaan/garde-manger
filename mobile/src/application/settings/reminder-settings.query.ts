import { defineQuery } from '../shared/define-query.js'

export const useReminderSettingsQuery = defineQuery(['reminder-settings'],
  (connector) => connector.getReminderSettings())
