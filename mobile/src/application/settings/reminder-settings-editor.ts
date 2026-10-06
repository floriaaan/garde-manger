import { t } from '../../i18n/index.js'
import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSetReminderSettingsMutation } from './set-reminder-settings.mutation.js'
import type { ReminderSettingsUpdate } from '../../domain/settings/reminder-settings.js'
import { showToast } from '../shared/toast.js'

export function useReminderSettingsEditor() {
  const mutation = useSetReminderSettingsMutation()
  const queryClient = useQueryClient()
  const saving = useRef(false)
  const [failedUpdate, setFailedUpdate] = useState<ReminderSettingsUpdate | null>(null)

  async function save(update: ReminderSettingsUpdate) {
    if (saving.current) return
    saving.current = true
    setFailedUpdate(null)
    showToast(t('common.saving'), 'loading')
    try {
      const result = await mutation.mutateAsync(update)
      if (!result.ok) throw result.error
      queryClient.setQueryData(['reminder-settings'], result.value)
      showToast(t('common.settings_saved'), 'success')
    } catch {
      setFailedUpdate(update)
      showToast(t('common.could_not_save_reminder'), 'error', {
        label: t('dashboard.try_again'), onPress: () => { void save(update) },
      })
    } finally {
      saving.current = false
    }
  }

  return {
    save,
    pending: mutation.isPending,
    failed: failedUpdate !== null,
    retry: () => { if (failedUpdate) void save(failedUpdate) },
  }
}
