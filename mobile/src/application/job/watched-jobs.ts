import { useEffect } from 'react'

/**
 * Jobs a screen is showing the progress of right now. `JobHost` skips the toast
 * for those: the member is looking at the outcome, a second notification would
 * be noise. Same module-level shape as `toast.ts`.
 */
const watched = new Map<string, number>()

export function isJobWatched(jobId: string): boolean {
  return (watched.get(jobId) ?? 0) > 0
}

export function useWatchJob(jobId: string | undefined): void {
  useEffect(() => {
    if (!jobId) return
    watched.set(jobId, (watched.get(jobId) ?? 0) + 1)
    return () => {
      const count = (watched.get(jobId) ?? 1) - 1
      if (count <= 0) watched.delete(jobId)
      else watched.set(jobId, count)
    }
  }, [jobId])
}
