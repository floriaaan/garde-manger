import type { JobRepository } from '#domain/job/interfaces/job-repository.interface'
import type { ScanDraftRepository } from '#domain/job/interfaces/scan-draft-repository.interface'
import type { StorageService } from '#domain/shared/interfaces/storage.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { Job } from '#domain/job/job.aggregate'
import type { ScanDraft } from '#domain/job/scan-draft'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import type { FridgeScanDraft, FridgeScanDraftItem } from '#domain/fridge/fridge-scan-draft'
import { mergeScanItems } from '#domain/fridge/fridge-scan-merge'
import { isFatal } from '#domain/job/retry-policy'
import { AiQuotaExceededError } from '#domain/settings/ai-quota-exceeded.error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import { ScanReceipt } from '#application/receipt/scan-receipt.use-case'
import { ScanFridge } from '#application/fridge/scan-fridge.use-case'
import { GenerateRecipes } from '#application/recipe/generate-recipes.use-case'

export interface RunJobDeps {
  jobs: JobRepository
  drafts: ScanDraftRepository
  storage: StorageService
  recipes: RecipeRepository
  products: ProductRepository
  idGenerator: IdGenerator
  clock: Clock
  // Resolved per unit, not once per job: the resolver is also where the monthly
  // quota is checked, and it must see the calls this very job already made.
  resolveReceiptExtraction: (householdId: string) => Promise<ReceiptExtractionPort>
  resolveFridgeScanExtraction: (householdId: string) => Promise<FridgeScanExtractionPort>
  resolveRecipeGeneration: (householdId: string) => Promise<RecipeGenerationPort>
  unitTimeoutMs: number
  draftTtlHours: number
}

class UnitTimeoutError extends Error {}

/** Runs one claimed job to a terminal (or re-queued) state. Never throws for a business failure. */
export class RunJob {
  constructor(private readonly deps: RunJobDeps) {}

  async execute(job: Job): Promise<void> {
    const failureType = job.kind === 'recipe_generation' ? 'generation_failed' : 'extraction_failed'
    try {
      if (job.kind === 'recipe_generation') await this.generate(job)
      else await this.scan(job)
    } catch {
      // Unexpected (bug, DB hiccup): same retry budget as any other failure.
      job.fail(failureType, this.deps.clock.now())
      await this.deps.jobs.save(job)
    }
  }

  private async generate(job: Job): Promise<void> {
    job.beginRun()
    const result = await this.attempt(async () => {
      const generation = await this.deps.resolveRecipeGeneration(job.householdId)
      return new GenerateRecipes(
        this.deps.recipes,
        this.deps.products,
        generation,
        this.deps.idGenerator,
        this.deps.clock,
      ).execute({
        householdId: job.householdId,
        createdBy: job.createdBy,
        prompt: job.input.prompt,
      })
    }, 'generation_failed')

    if (!result.ok) {
      job.recordUnit(0, false)
      job.fail(result.error, this.deps.clock.now())
    } else {
      job.recordUnit(0, true)
      job.succeed({ recipeIds: result.value.map((recipe) => recipe.id) }, this.deps.clock.now())
    }
    await this.deps.jobs.save(job)
  }

  private async scan(job: Job): Promise<void> {
    const keys = job.input.imageKeys ?? []
    const existing = job.result?.draftId
      ? await this.deps.drafts.findById(job.result.draftId)
      : null
    job.beginRun()

    let receiptDraft: ReceiptDraft | null = null
    const fridgeItems: FridgeScanDraftItem[] = []
    let lastError = 'extraction_failed'

    for (const index of job.pendingUnits()) {
      const outcome =
        job.kind === 'receipt_scan'
          ? await this.scanReceiptUnit(job, keys[index])
          : await this.scanFridgeUnit(job, keys[index])

      if (!outcome.ok) {
        job.recordUnit(index, false)
        lastError = outcome.error
        await this.deps.jobs.save(job)
        // Guaranteed to repeat on every remaining unit — don't spend them.
        if (isFatal(outcome.error)) break
        continue
      }
      job.recordUnit(index, true)
      if (job.kind === 'receipt_scan') receiptDraft = outcome.value as ReceiptDraft
      else fridgeItems.push(...(outcome.value as FridgeScanDraft).items)
      await this.deps.jobs.save(job)
    }

    const gotSomething = receiptDraft !== null || fridgeItems.length > 0 || job.progress.done > 0
    if (!gotSomething && !existing) {
      job.fail(lastError, this.deps.clock.now())
      await this.deps.jobs.save(job)
      return
    }

    const now = this.deps.clock.now()
    const previous =
      existing && existing.kind === 'fridge' ? (existing.payload as FridgeScanDraft).items : []
    const draft: ScanDraft = {
      id: existing?.id ?? this.deps.idGenerator.next(),
      householdId: job.householdId,
      jobId: job.id,
      kind: job.kind === 'receipt_scan' ? 'receipt' : 'fridge',
      payload: receiptDraft ?? { items: mergeScanItems([...previous, ...fridgeItems]) },
      imageKeys: keys,
      status: 'pending',
      expiresAt: new Date(now.getTime() + this.deps.draftTtlHours * 3_600_000),
      createdAt: existing?.createdAt ?? now,
    }
    job.succeed({ draftId: draft.id }, now)
    await this.deps.jobs.saveWithDraft(job, draft)
  }

  private async scanReceiptUnit(job: Job, key: string | undefined) {
    const image = key ? await this.deps.storage.read(key) : null
    if (!image) return Result.err('extraction_failed')
    return this.attempt(async () => {
      const extraction = await this.deps.resolveReceiptExtraction(job.householdId)
      return new ScanReceipt(extraction).execute({
        image: { buffer: image.buffer, contentType: image.contentType },
      })
    }, 'extraction_failed')
  }

  private async scanFridgeUnit(job: Job, key: string | undefined) {
    const image = key ? await this.deps.storage.read(key) : null
    if (!image) return Result.err('extraction_failed')
    return this.attempt(async () => {
      const extraction = await this.deps.resolveFridgeScanExtraction(job.householdId)
      return new ScanFridge(extraction).execute({ image: image.buffer })
    }, 'extraction_failed')
  }

  /** One AI call, bounded in time; quota and timeout become plain error types instead of exceptions. */
  private async attempt<T>(
    fn: () => Promise<ResultType<T, string>>,
    timeoutError: string,
  ): Promise<ResultType<T, string>> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new UnitTimeoutError()), this.deps.unitTimeoutMs)
    })
    try {
      return await Promise.race([fn(), timeout])
    } catch (error) {
      if (error instanceof AiQuotaExceededError) return Result.err('ai_quota_exceeded')
      if (error instanceof UnitTimeoutError) return Result.err(timeoutError)
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}
