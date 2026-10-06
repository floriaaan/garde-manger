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
    showToast('Enregistrement…', 'loading')
    try {
      const result = await mutation.mutateAsync(update)
      if (!result.ok) throw result.error
      queryClient.setQueryData(['reminder-settings'], result.value)
      showToast('Réglages enregistrés.', 'success')
    } catch {
      setFailedUpdate(update)
      showToast('Impossible d’enregistrer le rappel.', 'error', {
        label: 'Réessayer', onPress: () => { void save(update) },
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
