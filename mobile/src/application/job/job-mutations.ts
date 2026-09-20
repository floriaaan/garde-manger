import { useQueryClient } from '@tanstack/react-query'
import { useDomainMutation } from '../shared/use-domain-mutation.js'
import { removeJob, upsertJob } from './jobs.query.js'
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
    onSuccess: (_result, jobId) => removeJob(queryClient, jobId),
  })
}
