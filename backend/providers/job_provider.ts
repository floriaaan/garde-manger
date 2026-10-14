import type { GetScanDraft } from '#application/job/get-scan-draft.use-case'
import type { FinalizeScanDraft } from '#application/job/finalize-scan-draft.use-case'
import type { ListJobs } from '#application/job/list-jobs.use-case'
import type { GetJob } from '#application/job/get-job.use-case'
import type { RetryJob } from '#application/job/retry-job.use-case'
import type { DismissJob } from '#application/job/dismiss-job.use-case'
import type { RestoreJob } from '#application/job/restore-job.use-case'
import type { ListScanDrafts } from '#application/job/list-scan-drafts.use-case'
import type { DiscardScanDraft } from '#application/job/discard-scan-draft.use-case'
import type { EnqueueJob } from '#application/job/enqueue-job.use-case'
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
    this.app.container.bind('job.getScanDraft', async (resolver) => {
      const { GetScanDraft } = await import('#application/job/get-scan-draft.use-case')
      return new GetScanDraft(await resolver.make('job.scanDrafts'))
    })

    this.app.container.bind('job.finalizeScanDraft', async (resolver) => {
      const { FinalizeScanDraft } = await import('#application/job/finalize-scan-draft.use-case')
      return new FinalizeScanDraft(
        await resolver.make('job.scanDrafts'),
        await resolver.make('shared.storage'),
      )
    })

    this.app.container.bind('job.listJobs', async (resolver) => {
      const { ListJobs } = await import('#application/job/list-jobs.use-case')
      return new ListJobs(
        await resolver.make('job.jobs'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('job.getJob', async (resolver) => {
      const { GetJob } = await import('#application/job/get-job.use-case')
      return new GetJob(await resolver.make('job.jobs'))
    })

    this.app.container.bind('job.retryJob', async (resolver) => {
      const { RetryJob } = await import('#application/job/retry-job.use-case')
      return new RetryJob(
        await resolver.make('job.jobs'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('job.dismissJob', async (resolver) => {
      const { DismissJob } = await import('#application/job/dismiss-job.use-case')
      return new DismissJob(
        await resolver.make('job.jobs'),
        await resolver.make('shared.storage'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('job.restoreJob', async (resolver) => {
      const { RestoreJob } = await import('#application/job/restore-job.use-case')
      return new RestoreJob(await resolver.make('job.jobs'))
    })

    this.app.container.bind('job.listScanDrafts', async (resolver) => {
      const { ListScanDrafts } = await import('#application/job/list-scan-drafts.use-case')
      return new ListScanDrafts(await resolver.make('job.scanDrafts'))
    })

    this.app.container.bind('job.discardScanDraft', async (resolver) => {
      const { DiscardScanDraft } = await import('#application/job/discard-scan-draft.use-case')
      return new DiscardScanDraft(
        await resolver.make('job.scanDrafts'),
        await resolver.make('shared.storage'),
      )
    })

    this.app.container.bind('job.enqueueJob', async (resolver) => {
      const { EnqueueJob } = await import('#application/job/enqueue-job.use-case')
      return new EnqueueJob(
        await resolver.make('job.jobs'),
        await resolver.make('shared.storage'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

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
        await notifyJobFinished
          .execute(job)
          .catch((error) => logger.error({ err: error }, 'Job push failed'))
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
    'job.getScanDraft': GetScanDraft
    'job.finalizeScanDraft': FinalizeScanDraft
    'job.listJobs': ListJobs
    'job.getJob': GetJob
    'job.retryJob': RetryJob
    'job.dismissJob': DismissJob
    'job.restoreJob': RestoreJob
    'job.listScanDrafts': ListScanDrafts
    'job.discardScanDraft': DiscardScanDraft
    'job.enqueueJob': EnqueueJob
    'job.jobs': JobRepository
    'job.scanDrafts': ScanDraftRepository
  }
}
