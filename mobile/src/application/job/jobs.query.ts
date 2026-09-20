import { useQuery } from '@tanstack/react-query'
import type { QueryClient, UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useConnector } from '../shared/connector-context.js'
import { useDomainQuery } from '../shared/use-domain-query.js'
import { isJobActive } from '../../domain/job/job.js'
import type { Job } from '../../domain/job/job.js'

export const JOBS_KEY = ['jobs']
const POLL_MS = 2000

const pollWhileActive = (query: { state: { data: Job[] | undefined } }) =>
  query.state.data?.some(isJobActive) ? POLL_MS : false

/**
 * Polls while (and only while) some job is active — no active job, no
 * request. `upsertJob` seeds the cache on enqueue so the very first
 * `refetchInterval` evaluation already sees the new job as active.
 */
export function useJobsQuery(
  options?: Omit<UseQueryOptions<Job[]>, 'queryKey' | 'queryFn'>,
): UseQueryResult<Job[]> {
  return useDomainQuery(JOBS_KEY, (connector) => connector.getJobs(), {
    refetchInterval: pollWhileActive,
    ...options,
  })
}

/** Read from the list rather than its own request: one poll serves every watcher. */
export function useJobQuery(jobId: string | undefined): UseQueryResult<Job | null> {
  const connector = useConnector()
  return useQuery({
    queryKey: JOBS_KEY,
    queryFn: () => connector.getJobs(),
    refetchInterval: pollWhileActive,
    select: (jobs: Job[]) => jobs.find((job) => job.id === jobId) ?? null,
  })
}

export function upsertJob(queryClient: QueryClient, job: Job): void {
  queryClient.setQueryData<Job[]>(JOBS_KEY, (jobs = []) => [job, ...jobs.filter((j) => j.id !== job.id)])
}
