import { useQueryClient } from '@tanstack/react-query'
import { useDomainMutation } from '../shared/use-domain-mutation.js'
import { JOBS_KEY, upsertJob } from './jobs.query.js'
import type { Result } from '../../domain/shared/result.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { Job } from '../../domain/job/job.js'

/** Every enqueue answers with the queued job; seeding the cache with it starts the polling. */
function useSeedJob() {
  const queryClient = useQueryClient()
  return (result: Result<Job, ApiError>) => {
    if (result.ok) upsertJob(queryClient, result.value)
  }
}

export function useEnqueueReceiptScanMutation() {
  const seed = useSeedJob()
  return useDomainMutation((connector, imageUri: string) => connector.enqueueReceiptScan(imageUri), {
    onSuccess: seed,
  })
}

export function useEnqueueFridgeScanMutation() {
  const seed = useSeedJob()
  return useDomainMutation((connector, imageUris: string[]) => connector.enqueueFridgeScan(imageUris), {
    onSuccess: seed,
  })
}

export function useEnqueueRecipeGenerationMutation() {
  const seed = useSeedJob()
  return useDomainMutation((connector, prompt: string | undefined) => connector.enqueueRecipeGeneration(prompt), {
    onSuccess: seed,
  })
}

export function useRetryJobMutation() {
  const seed = useSeedJob()
  return useDomainMutation((connector, jobId: string) => connector.retryJob(jobId), { onSuccess: seed })
}

export function useDismissJobMutation() {
  const queryClient = useQueryClient()
  return useDomainMutation((connector, jobId: string) => connector.dismissJob(jobId), {
    onSettled: () => queryClient.invalidateQueries({ queryKey: JOBS_KEY }),
  })
}

/** Hides a finished job. */
export const useHideJobMutation = useDismissJobMutation

export function useRestoreJobMutation() {
  const queryClient = useQueryClient()
  return useDomainMutation((connector, jobId: string) => connector.restoreJob(jobId), {
    onSettled: () => queryClient.invalidateQueries({ queryKey: JOBS_KEY }),
  })
}

/**
 * Deletes a job outright. The server hides on the first DELETE and removes on
 * the second, so a visible job needs both; a hidden one only the second.
 */
export function useDeleteJobMutation() {
  const queryClient = useQueryClient()
  return useDomainMutation(
    async (connector, job: Job) => {
      if (!job.dismissedAt) await connector.dismissJob(job.id)
      return connector.dismissJob(job.id)
    },
    { onSettled: () => queryClient.invalidateQueries({ queryKey: JOBS_KEY }) },
  )
}
