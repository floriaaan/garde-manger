import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { trace } from '@opentelemetry/api'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import { generateRecipesValidator } from '#presentation/recipe/recipe.validator'
import { toJobDto, toScanDraftDto } from './job.dto.js'
import { AiQuotaExceededError } from '#domain/settings/ai-quota-exceeded.error'
import type { JobKind } from '#domain/job/job.aggregate'
import { EnqueueJob } from '#application/job/enqueue-job.use-case'
import { ListJobs } from '#application/job/list-jobs.use-case'
import { GetJob } from '#application/job/get-job.use-case'
import { RetryJob } from '#application/job/retry-job.use-case'
import { DismissJob } from '#application/job/dismiss-job.use-case'
import { RestoreJob } from '#application/job/restore-job.use-case'
import { GetScanDraft } from '#application/job/get-scan-draft.use-case'
import { ListScanDrafts } from '#application/job/list-scan-drafts.use-case'
import { DiscardScanDraft } from '#application/job/discard-scan-draft.use-case'

const MAX_FRIDGE_PHOTOS = 5
const IMAGE_RULES = { extnames: ['jpg', 'jpeg', 'png', 'webp'], size: '10mb' }

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function currentTraceparent(): string | null {
  const span = trace.getActiveSpan()?.spanContext()
  return span ? `00-${span.traceId}-${span.spanId}-0${span.traceFlags & 1}` : null
}

export default class JobController {
  async enqueueReceiptScan(ctx: HttpContext) {
    return this.enqueue(ctx, 'receipt_scan', 'job.enqueue_receipt_scan')
  }

  async enqueueFridgeScan(ctx: HttpContext) {
    return this.enqueue(ctx, 'fridge_scan', 'job.enqueue_fridge_scan')
  }

  async enqueueRecipeGeneration(ctx: HttpContext) {
    return this.enqueue(ctx, 'recipe_generation', 'job.enqueue_recipe_generation')
  }

  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      ListJobs,
      async () => {
        const jobs = await ctx.containerResolver.make('job.jobs')
        const clock = await ctx.containerResolver.make('shared.clock')
        const result = await new ListJobs(jobs, clock).execute({ householdId: ctx.household.id })
        ctx.response.json({ jobs: result.map(toJobDto) })
      },
      { action: 'job.get_jobs' },
    )
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      GetJob,
      async () => {
        const jobs = await ctx.containerResolver.make('job.jobs')
        const job = await new GetJob(jobs).execute({
          householdId: ctx.household.id,
          jobId: ctx.params.id,
        })
        if (!job) {
          const { status, body } = serializeError('job_not_found')
          ctx.response.status(status).json(body)
          return { failed: true }
        }
        ctx.response.json({ job: toJobDto(job) })
        return { failed: false }
      },
      { isError: (r) => r.failed, action: 'job.get_job' },
    )
  }

  async retry(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      RetryJob,
      async () => {
        const jobs = await ctx.containerResolver.make('job.jobs')
        const clock = await ctx.containerResolver.make('shared.clock')
        const result = await new RetryJob(jobs, clock).execute({
          householdId: ctx.household.id,
          jobId: ctx.params.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(202).json({ job: toJobDto(result.value) })
        return result
      },
      { isError: (r) => !r.ok, action: 'job.retry' },
    )
  }

  async dismiss(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      DismissJob,
      async () => {
        const jobs = await ctx.containerResolver.make('job.jobs')
        const storage = await ctx.containerResolver.make('shared.storage')
        const clock = await ctx.containerResolver.make('shared.clock')
        const result = await new DismissJob(jobs, storage, clock).execute({
          householdId: ctx.household.id,
          jobId: ctx.params.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(204).send('')
        return result
      },
      { isError: (r) => !r.ok, action: 'job.dismiss' },
    )
  }

  async restore(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      RestoreJob,
      async () => {
        const jobs = await ctx.containerResolver.make('job.jobs')
        const result = await new RestoreJob(jobs).execute({
          householdId: ctx.household.id,
          jobId: ctx.params.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(204).send('')
        return result
      },
      { isError: (r) => !r.ok, action: 'job.restore' },
    )
  }

  async listDrafts(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      ListScanDrafts,
      async () => {
        const drafts = await ctx.containerResolver.make('job.scanDrafts')
        const result = await new ListScanDrafts(drafts).execute({ householdId: ctx.household.id })
        ctx.response.json({ drafts: result.map(toScanDraftDto) })
      },
      { action: 'job.get_scan_drafts' },
    )
  }

  async showDraft(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      GetScanDraft,
      async () => {
        const drafts = await ctx.containerResolver.make('job.scanDrafts')
        const draft = await new GetScanDraft(drafts).execute({
          householdId: ctx.household.id,
          draftId: ctx.params.id,
        })
        if (!draft) {
          const { status, body } = serializeError('draft_not_found')
          ctx.response.status(status).json(body)
          return { failed: true }
        }
        ctx.response.json({ draft: toScanDraftDto(draft) })
        return { failed: false }
      },
      { isError: (r) => r.failed, action: 'job.get_scan_draft' },
    )
  }

  async discardDraft(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      DiscardScanDraft,
      async () => {
        const drafts = await ctx.containerResolver.make('job.scanDrafts')
        const storage = await ctx.containerResolver.make('shared.storage')
        const result = await new DiscardScanDraft(drafts, storage).execute({
          householdId: ctx.household.id,
          draftId: ctx.params.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(204).send('')
        return result
      },
      { isError: (r) => !r.ok, action: 'job.discard_scan_draft' },
    )
  }

  private async enqueue(ctx: HttpContext, kind: JobKind, action: string) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'job',
      EnqueueJob,
      async () => {
        let images: { buffer: Buffer; contentType: string }[] | undefined
        let prompt: string | undefined

        if (kind === 'recipe_generation') {
          const body = await ctx.request.validateUsing(generateRecipesValidator)
          prompt = body.prompt
        } else {
          const files =
            kind === 'receipt_scan'
              ? [ctx.request.file('image', IMAGE_RULES)]
              : ctx.request.files('images', IMAGE_RULES)
          const usable = files.filter((file) => file?.tmpPath && file.isValid)
          const tooMany = kind === 'fridge_scan' && files.length > MAX_FRIDGE_PHOTOS
          if (usable.length === 0 || usable.length !== files.length || tooMany) {
            logger.warn(
              { kind, received: files.length, usable: usable.length },
              'job enqueue: no usable file in upload',
            )
            const { status, body } = serializeError('extraction_failed')
            ctx.response.status(status).json(body)
            return { failed: true }
          }
          images = await Promise.all(
            usable.map(async (file) => ({
              buffer: await readFile(file!.tmpPath!),
              contentType: CONTENT_TYPES[file!.extname ?? 'jpg'] ?? 'image/jpeg',
            })),
          )
        }

        // Refuse up front when the quota is already spent, so no job row (and no
        // stored photo) is created for a request that could never run. A provider
        // that is merely unconfigured is left to the worker to report.
        const resolve = await ctx.containerResolver.make(
          kind === 'receipt_scan'
            ? 'settings.resolveReceiptExtractionPort'
            : kind === 'fridge_scan'
              ? 'settings.resolveFridgeScanExtractionPort'
              : 'settings.resolveRecipeGenerationPort',
        )
        try {
          await resolve(ctx.household.id)
        } catch (error) {
          if (error instanceof AiQuotaExceededError) throw error
        }

        const jobs = await ctx.containerResolver.make('job.jobs')
        const storage = await ctx.containerResolver.make('shared.storage')
        const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
        const clock = await ctx.containerResolver.make('shared.clock')
        const job = await new EnqueueJob(jobs, storage, idGenerator, clock).execute({
          householdId: ctx.household.id,
          createdBy: user.id,
          kind,
          images,
          prompt,
          traceparent: currentTraceparent(),
        })
        ctx.response.status(202).json({ job: toJobDto(job) })
        return { failed: false, jobId: job.id }
      },
      {
        isError: (r) => r.failed,
        entityId: (r) => r.jobId,
        action,
      },
    )
  }
}
