import type { UseCase } from '#application/shared/use-case'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { PushSender } from '#domain/push/interfaces/push-sender.interface'
import type { Job } from '#domain/job/job.aggregate'

const WHAT: Record<Job['kind'], string> = {
  receipt_scan: 'Ton ticket',
  fridge_scan: 'Ton scan du frigo',
  recipe_generation: 'Tes recettes',
}

/** Tells whoever started a task that it is over — the case a toast cannot reach, app in the background. */
export class NotifyJobFinished implements UseCase<Job, void> {
  constructor(
    private readonly tokens: PushTokenRepository,
    private readonly sender: PushSender,
  ) {}

  async execute(job: Job): Promise<void> {
    // `queued` again = a retry is coming; `running` never reaches here.
    if (job.status !== 'succeeded' && job.status !== 'failed') return
    if (!job.createdBy) return

    const tokens = await this.tokens.listForUser(job.createdBy)
    if (tokens.length === 0) return

    const failed = job.status === 'failed'
    const title = failed ? 'Analyse impossible' : 'C’est prêt'
    const body = failed
      ? `${WHAT[job.kind]} n’a pas pu être analysé${job.kind === 'recipe_generation' ? 'es' : ''}.`
      : `${WHAT[job.kind]} ${job.kind === 'recipe_generation' ? 'sont prêtes' : 'est prêt à relire'}.`

    const { invalidTokens } = await this.sender.send(
      tokens.map((to) => ({ to, title, body, data: { route: '/tasks' } })),
    )
    if (invalidTokens.length > 0) await this.tokens.deleteMany(invalidTokens)
  }
}
