import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSetReminderSettingsMutation } from './set-reminder-settings.mutation.js'
import type { ReminderSettingsUpdate } from '../../domain/settings/reminder-settings.js'

export function useReminderSettingsEditor() {
  const mutation = useSetReminderSettingsMutation()
  const queryClient = useQueryClient()
  const saving = useRef(false)
  const [failedUpdate, setFailedUpdate] = useState<ReminderSettingsUpdate | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function save(update: ReminderSettingsUpdate) {
    if (saving.current) return
    saving.current = true
    setFailedUpdate(null)
    setFeedback('Enregistrement…')
    try {
      const result = await mutation.mutateAsync(update)
      if (!result.ok) {
        setFailedUpdate(update)
        setFeedback('Impossible d’enregistrer le rappel. Réessaie.')
        return
      }
      queryClient.setQueryData(['reminder-settings'], result.value)
      setFeedback('Réglages enregistrés.')
    } catch {
      setFailedUpdate(update)
      setFeedback('Impossible d’enregistrer le rappel. Réessaie.')
    } finally {
      saving.current = false
    }
  }

  return {
    save,
    pending: mutation.isPending,
    feedback,
    failed: failedUpdate !== null,
    retry: () => { if (failedUpdate) void save(failedUpdate) },
  }
}
