import type { ApplicationService } from '@adonisjs/core/types'
import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { ScanDraftRepository } from '#domain/job/interfaces/scan-draft-repository.interface'
import type { JobRunner } from '#infrastructure/job/job-runner'

/**
 * Wires the async AI-task queue and, in the web process only, starts the
 * in-process worker (cf. docs/adr/0016). Lives outside `src/` like the other
 * providers: it is where an infrastructure class is bound to its port.
 */
export default class JobProvider {
  private runner: JobRunner | null = null

  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('job.jobs', async () => {
      const { LucidJobRepository } = await import('#infrastructure/database/job/job.repository')
      return new LucidJobRepository()
    })

    this.app.container.singleton('job.scanDrafts', async () => {
      const { LucidScanDraftRepository } =
        await import('#infrastructure/database/job/scan-draft.repository')
      return new LucidScanDraftRepository()
    })
  }

  async ready() {
    if (this.app.getEnvironment() !== 'web') return
    const { default: env } = await import('#start/env')
    if (!env.get('JOB_WORKER_ENABLED', true)) return

    const container = this.app.container
    const [jobs, drafts, storage, recipes, products, idGenerator, clock] = await Promise.all([
      container.make('job.jobs'),
      container.make('job.scanDrafts'),
      container.make('shared.storage'),
      container.make('recipe.recipes'),
      container.make('fridge.products'),
      container.make('shared.idGenerator'),
      container.make('shared.clock'),
    ])
    const [resolveReceiptExtraction, resolveFridgeScanExtraction, resolveRecipeGeneration] =
      await Promise.all([
        container.make('settings.resolveReceiptExtractionPort'),
        container.make('settings.resolveFridgeScanExtractionPort'),
        container.make('settings.resolveRecipeGenerationPort'),
      ])
    const [pushTokens, pushSender] = await Promise.all([
      container.make('push.tokens'),
      container.make('push.sender'),
    ])
    const logger = await container.make('logger')

    const { RunJob } = await import('#application/job/run-job.use-case')
    const { PurgeExpired } = await import('#application/job/purge-expired.use-case')
    const { NotifyJobFinished } = await import('#application/push/notify-job-finished.use-case')
    const { JobRunner } = await import('#infrastructure/job/job-runner')

    const runJob = new RunJob({
      jobs,
      drafts,
      storage,
      recipes,
      products,
      idGenerator,
      clock,
      resolveReceiptExtraction,
      resolveFridgeScanExtraction,
      resolveRecipeGeneration,
      unitTimeoutMs: env.get('JOB_UNIT_TIMEOUT_MS', 120_000),
      draftTtlHours: env.get('SCAN_DRAFT_TTL_HOURS', 48),
    })
    const purge = new PurgeExpired(drafts, jobs, storage, clock)

    const notifyJobFinished = new NotifyJobFinished(pushTokens, pushSender)

    this.runner = new JobRunner({
      jobs,
      run: async (job) => {
        await runJob.execute(job)
        await notifyJobFinished.execute(job).catch((error) => logger.error({ err: error }, 'Job push failed'))
      },
      purge: () => purge.execute(),
      clock,
      maxConcurrency: env.get('JOB_MAX_CONCURRENCY', 2),
      onError: (error, message) => logger.error({ err: error }, message),
    })
    await this.runner.start()
  }

  async shutdown() {
    await this.runner?.stop()
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'job.jobs': JobRepository
    'job.scanDrafts': ScanDraftRepository
  }
}
