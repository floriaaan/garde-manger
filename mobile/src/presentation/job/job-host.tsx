import { t } from '../../i18n/index.js'
import { useEffect, useRef } from 'react'
import { router } from 'expo-router'
import { useJobsQuery } from '../../application/job/jobs.query.js'
import { findFinishedTransitions } from '../../application/job/job-transitions.js'
import { isJobWatched } from '../../application/job/watched-jobs.js'
import { celebrate } from '../../application/shared/confetti.js'
import { showToast } from '../../application/shared/toast.js'
import { hasPartialFailure } from '../../domain/job/job.js'
import type { Job } from '../../domain/job/job.js'
import { outcomeMessage, outcomeRoute } from './job-labels.js'

function announce(job: Job): void {
  const route = outcomeRoute(job)
  const open = () => router.push(route as Parameters<typeof router.push>[0])
  if (job.status === 'failed') {
    showToast(outcomeMessage(job), 'error', { label: t('job.view'), onPress: open })
    return
  }
  const label = job.kind === 'recipe_generation' ? t('job.view') : t('dashboard.review')
  const suffix = hasPartialFailure(job) ? t('job.partial_failure_suffix') : ''
  showToast(outcomeMessage(job) + suffix, 'success', { label, onPress: open })
}

/**
 * Renderless: celebrates each successful transition once. A watched job
 * skips the toast because its screen already shows the outcome.
 */
export function JobHost() {
  const jobs = useJobsQuery().data
  const previous = useRef<Map<string, Job>>(new Map())

  useEffect(() => {
    if (!jobs) return
    for (const job of findFinishedTransitions(previous.current, jobs)) {
      if (job.status === 'succeeded') celebrate()
      if (!isJobWatched(job.id)) announce(job)
    }
    previous.current = new Map(jobs.map((job) => [job.id, job]))
  }, [jobs])

  return null
}
