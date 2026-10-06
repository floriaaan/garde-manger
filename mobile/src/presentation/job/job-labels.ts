import { t } from '../../i18n/index.js'
import type { Job, JobKind } from '../../domain/job/job.js'
import { platformCapabilities } from '../../application/shared/platform-capabilities.js'

export const JOB_TITLES: Record<JobKind, string> = {
  get receipt_scan() { return t('job.receipt_analysis') },
  get fridge_scan() { return t('job.fridge_analysis') },
  get recipe_generation() { return t('job.recipe_ideas') },
}

/** The one line under the title while the job is not finished. */
export function activeLabel(job: Job, behind = false): string {
  const { done, total } = job.progress
  if (job.status === 'queued') return behind ? t('job.waiting_for_the_previous_analysis') : t('fridge.waiting')
  if (job.kind === 'fridge_scan') return t('job.photo_of', { value1: Math.min(done + 1, total), value2: total })
  return job.kind === 'recipe_generation' ? t('job.cooking') : t('job.reading')
}

/** What a finished job says — also the toast copy, so the two never disagree. */
export function outcomeMessage(job: Job, itemCount?: number): string {
  if (job.status === 'failed') return t('job.failed', { value1: JOB_TITLES[job.kind] })
  switch (job.kind) {
    case 'receipt_scan':
      return itemCount === undefined ? t('job.receipt_analysed') : t('job.receipt_analysed_count', { count: itemCount })
    case 'fridge_scan':
      return itemCount === undefined ? t('job.fridge_analysed') : t('job.fridge_analysed_count', { count: itemCount })
    case 'recipe_generation': {
      const count = job.result?.recipeIds?.length ?? 0
      return t('common.recipe_ready_count', { count })
    }
  }
}

/** Where "Voir" / "Relire" leads for a finished job. */
export function outcomeRoute(job: Job): { pathname: string; params?: Record<string, string> } {
  if (job.status === 'succeeded' && job.kind === 'recipe_generation') return { pathname: '/(tabs)/recipes' }
  if (job.status === 'succeeded' && job.result?.draftId) {
    const params = { draftId: job.result.draftId }
    return job.kind === 'receipt_scan'
      ? { pathname: '/receipts/review', params }
      : { pathname: '/fridge-scan/review', params }
  }
  return { pathname: '/tasks' }
}

/** A queued job waits when the household already has another one running (one at a time per foyer). */
export function isBehindAnother(job: Job, jobs: Job[]): boolean {
  return job.status === 'queued' && jobs.some((other) => other.id !== job.id && other.status === 'running')
}

/** What went wrong and what to do about it — the backend message stays a fallback, it is not written for members. */
export function failureMessage(job: Job): string {
  switch (job.error?.type) {
    case 'ai_quota_exceeded':
      return platformCapabilities.billing
        ? t('job.free_quota_reached_upgrade_to_the_ai_plan_to_continue')
        : t('job.monthly_quota_reached_it_resets_on_the_first_of_the')
    case 'provider_not_configured':
      return t('job.ai_isn_t_configured_on_this_server_ask_the_administrator')
    case 'unsupported_format':
      return t('job.this_ai_provider_can_t_read_pdfs_try_a_photo')
    default:
      // A recipe generation has no photo to blame — it failed on the ask.
      return job.kind === 'recipe_generation'
        ? t('job.try_again_or_ask_for_something_simpler', { value1: outcomeMessage(job) })
        : t('job.try_again_or_retake_the_photo_if_it_s_blurry', { value1: outcomeMessage(job) })
  }
}

/** Errors a second attempt cannot fix. */
export function isRetryable(job: Job): boolean {
  return (
    job.status === 'failed' &&
    job.error?.type !== 'ai_quota_exceeded' &&
    job.error?.type !== 'provider_not_configured' &&
    job.error?.type !== 'unsupported_format'
  )
}

/** "à l’instant" / "il y a 5 min" / "il y a 3 h" / "hier" — the age of a task, which the task center is otherwise silent about. */
export function taskAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return t('job.just_now')
  if (minutes < 60) return t('job.min_ago', { value1: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('job.h_ago', { value1: hours })
  return hours < 48 ? t('job.yesterday') : t('job.days_ago', { value1: Math.floor(hours / 24) })
}
