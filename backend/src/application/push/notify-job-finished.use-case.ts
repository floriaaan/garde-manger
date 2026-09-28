import type { UseCase } from '#application/shared/use-case'
import type { PushTokenRepository } from '#domain/push/interfaces/push-token-repository.interface'
import type { PushSender } from '#domain/push/interfaces/push-sender.interface'
import type { Job } from '#domain/job/job.aggregate'

const MESSAGES: Record<
  Job['kind'],
  { success: { title: string; body: string }; failure: { title: string; body: string } }
> = {
  receipt_scan: {
    success: {
      title: 'Ticket déchiffré 🧾',
      body: 'Les produits sont prêts. Un coup d’œil avant de les ajouter ?',
    },
    failure: {
      title: 'Le ticket fait de la résistance 🧾',
      body: 'Je n’ai pas réussi à le lire. Tu peux réessayer depuis les tâches.',
    },
  },
  fridge_scan: {
    success: {
      title: 'Frigo exploré 📸',
      body: 'J’ai repéré des produits. Vérifie ma récolte avant de les ranger.',
    },
    failure: {
      title: 'Le frigo m’a échappé 📸',
      body: 'Je n’ai pas terminé le scan. Retente depuis les tâches.',
    },
  },
  recipe_generation: {
    success: { title: 'À table ! 🍽️', body: 'Tes nouvelles idées de recettes t’attendent.' },
    failure: {
      title: 'La cuisine prend une pause 🍳',
      body: 'Je n’ai pas pu créer tes recettes. Réessaie depuis les tâches.',
    },
  },
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

    const { title, body } = MESSAGES[job.kind][job.status === 'failed' ? 'failure' : 'success']

    const { invalidTokens } = await this.sender.send(
      tokens.map((to) => ({ to, title, body, data: { route: '/tasks' } })),
    )
    if (invalidTokens.length > 0) await this.tokens.deleteMany(invalidTokens)
  }
}
