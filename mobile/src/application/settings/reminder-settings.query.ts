import { defineHouseholdQuery } from '../shared/use-household-domain-query.js'

export const useReminderSettingsQuery = defineHouseholdQuery(['reminder-settings'],
  (connector) => connector.getReminderSettings())
