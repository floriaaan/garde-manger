import type { Job, JobKind } from '../../domain/job/job.js'

export const JOB_TITLES: Record<JobKind, string> = {
  receipt_scan: 'Analyse du ticket',
  fridge_scan: 'Analyse du frigo',
  recipe_generation: 'Idées de recettes',
}

/** The one line under the title while the job is not finished. */
export function activeLabel(job: Job): string {
  const { done, total } = job.progress
  if (job.status === 'queued') return 'En attente…'
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
