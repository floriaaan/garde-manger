import { isJobActive } from '../../domain/job/job.js'
import type { Job } from '../../domain/job/job.js'

/**
 * Jobs that were active on the previous look and are finished on this one.
 * Only a transition counts: a job already finished when the app opens is not
 * news (the dashboard's "brouillon à relire" banner carries that case).
 */
export function findFinishedTransitions(previous: ReadonlyMap<string, Job>, current: Job[]): Job[] {
  return current.filter((job) => {
    const before = previous.get(job.id)
    return before !== undefined && isJobActive(before) && !isJobActive(job)
  })
}
