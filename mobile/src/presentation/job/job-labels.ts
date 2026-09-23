import type { Job, JobKind } from '../../domain/job/job.js'
import { platformCapabilities } from '../../application/shared/platform-capabilities.js'

export const JOB_TITLES: Record<JobKind, string> = {
  receipt_scan: 'Analyse du ticket',
  fridge_scan: 'Analyse du frigo',
  recipe_generation: 'Idées de recettes',
}

/** The one line under the title while the job is not finished. */
export function activeLabel(job: Job, behind = false): string {
  const { done, total } = job.progress
  if (job.status === 'queued') return behind ? 'En attente de l’analyse précédente…' : 'En attente…'
  if (job.kind === 'fridge_scan') return `Photo ${Math.min(done + 1, total)} sur ${total}`
  return job.kind === 'recipe_generation' ? 'Cuisine en cours…' : 'Lecture en cours…'
}

/** What a finished job says — also the toast copy, so the two never disagree. */
export function outcomeMessage(job: Job, itemCount?: number): string {
  if (job.status === 'failed') return `${JOB_TITLES[job.kind]} : échec`
  const n = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`
  switch (job.kind) {
    case 'receipt_scan':
      return itemCount === undefined ? 'Ticket analysé' : `Ticket analysé — ${n(itemCount, 'article', 'articles')}`
    case 'fridge_scan':
      return itemCount === undefined ? 'Frigo analysé' : `Frigo analysé — ${n(itemCount, 'produit', 'produits')}`
    case 'recipe_generation': {
      const count = job.result?.recipeIds?.length ?? 0
      return `${n(count, 'recette prête', 'recettes prêtes')}`
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
        ? 'Quota gratuit atteint. Passe à l’offre IA pour continuer.'
        : 'Quota du mois atteint. Il se renouvelle le 1er du mois.'
    case 'provider_not_configured':
      return 'L’IA n’est pas configurée sur ce serveur. Demande à l’administrateur.'
    default:
      return `${outcomeMessage(job)}. Réessaie, ou reprends la photo si elle est floue.`
  }
}

/** Errors a second attempt cannot fix. */
export function isRetryable(job: Job): boolean {
  return job.status === 'failed' && job.error?.type !== 'ai_quota_exceeded' && job.error?.type !== 'provider_not_configured'
}

/** "à l’instant" / "il y a 5 min" / "il y a 3 h" / "hier" — the age of a task, which the task center is otherwise silent about. */
export function taskAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return hours < 48 ? 'hier' : `il y a ${Math.floor(hours / 24)} j`
}
