import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import { importReceiptValidator } from './receipt.validator.js'
import { toReceiptDto } from './receipt.dto.js'
import { toProductDto } from '#presentation/fridge/product.dto'
import { GetScanDraft } from '#application/job/get-scan-draft.use-case'
import { FinalizeScanDraft } from '#application/job/finalize-scan-draft.use-case'
import { ImportReceipt } from '#application/receipt/import-receipt.use-case'
import { GetReceipt } from '#application/receipt/get-receipt.use-case'
import { ListReceipts } from '#application/receipt/list-receipts.use-case'

export default class ReceiptController {
  async importReceipt(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'receipt',
      ImportReceipt,
      async () => {
        const payload = await ctx.request.validateUsing(importReceiptValidator)
        const scanDrafts = await ctx.containerResolver.make('job.scanDrafts')
        // A draft-backed import carries the scanned photo over to the receipt; the
        // key comes from the server-side draft, never from client input.
        const draft = payload.draftId
          ? await new GetScanDraft(scanDrafts).execute({
              householdId: ctx.household.id,
              draftId: payload.draftId,
            })
          : null
        if (payload.draftId && (!draft || draft.kind !== 'receipt')) {
          const { status, body } = serializeError('draft_not_found')
          ctx.response.status(status).json(body)
          return { ok: false as const, error: 'draft_not_found' as const }
        }
        const receipts = await ctx.containerResolver.make('receipt.receipts')
        const products = await ctx.containerResolver.make('fridge.products')
        const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
        const clock = await ctx.containerResolver.make('shared.clock')

        const result = await new ImportReceipt(receipts, products, idGenerator, clock).execute({
          householdId: ctx.household.id,
          storeName: payload.storeName,
          scannedAt: payload.scannedAt,
          totalAmount: payload.totalAmount,
          // Server-generated only (the draft's stored photo); never sourced from client
          // input to avoid unsanitized data reaching filesystem paths.
          imageKey: draft?.imageKeys[0] ?? null,
          items: payload.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category ?? null,
            price: item.price ?? null,
            location: item.location,
            expiresAt: item.expiresAt ?? null,
          })),
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }

        if (draft) {
          const storage = await ctx.containerResolver.make('shared.storage')
          await new FinalizeScanDraft(scanDrafts, storage).execute(draft)
        }

        ctx.response.status(201).json({
          receipt: toReceiptDto(result.value.receipt),
          products: result.value.products.map(toProductDto),
        })
        return result
      },
      {
        isError: (r) => !r.ok,
        entityId: (r) => (r.ok ? r.value.receipt.id : undefined),
        action: 'receipt.import',
      },
    )
  }

  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'receipt',
      ListReceipts,
      async () => {
        const receipts = await ctx.containerResolver.make('receipt.receipts')
        const result = await new ListReceipts(receipts).execute({ householdId: ctx.household.id })
        ctx.response.json({ receipts: result.map(toReceiptDto) })
      },
      { action: 'receipt.get_receipts' },
    )
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'receipt',
      GetReceipt,
      async () => {
        const receipts = await ctx.containerResolver.make('receipt.receipts')
        const products = await ctx.containerResolver.make('fridge.products')
        const result = await new GetReceipt(receipts, products).execute({
          householdId: ctx.household.id,
          receiptId: ctx.params.id,
        })
        if (!result) {
          const { status, body } = serializeError('receipt_not_found')
          ctx.response.status(status).json(body)
          return { failed: true }
        }
        ctx.response.json({
          receipt: toReceiptDto(result.receipt),
          products: result.products.map(toProductDto),
        })
        return { failed: false }
      },
      { isError: (r) => r.failed },
    )
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'receipt',
      { name: 'GetReceiptImage' },
      async () => {
        const receipts = await ctx.containerResolver.make('receipt.receipts')
        const receipt = await receipts.findById(ctx.params.id)
        if (!receipt || receipt.householdId !== ctx.household.id || !receipt.imageKey) {
          const { status, body } = serializeError('image_not_found')
          ctx.response.status(status).json(body)
          return { failed: true }
        }

        const storage = await ctx.containerResolver.make('shared.storage')
        const file = await storage.read(receipt.imageKey)
        if (!file) {
          const { status, body } = serializeError('image_not_found')
          ctx.response.status(status).json(body)
          return { failed: true }
        }

        ctx.response.header('Content-Type', file.contentType)
        ctx.response.send(file.buffer)
        return { failed: false }
      },
      { isError: (r) => r.failed },
    )
  }
}
