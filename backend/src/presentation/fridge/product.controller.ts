import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  createProductValidator,
  updateProductValidator,
  listProductsValidator,
  expiringSoonValidator,
  lookupProductValidator,
  recordProductOutcomeValidator,
  productOutcomeStatsValidator,
  importProductsValidator,
} from './product.validator.js'
import { toProductDto } from './product.dto.js'
import { toProductOutcomeDto } from './product-outcome.dto.js'
import { toProductOutcomeStatsDto } from './product-outcome-stats.dto.js'
import { CreateProduct } from '#application/fridge/create-product.use-case'
import { UpdateProduct } from '#application/fridge/update-product.use-case'
import { DeleteProduct } from '#application/fridge/delete-product.use-case'
import { GetProduct } from '#application/fridge/get-product.use-case'
import { ListProducts } from '#application/fridge/list-products.use-case'
import { GetExpiringSoonProducts } from '#application/fridge/get-expiring-soon-products.use-case'
import { LookupProduct } from '#application/fridge/lookup-product.use-case'
import { RecordProductOutcome } from '#application/fridge/record-product-outcome.use-case'
import { GetProductOutcomeStats } from '#application/fridge/get-product-outcome-stats.use-case'
import { GetScanDraft } from '#application/job/get-scan-draft.use-case'
import { FinalizeScanDraft } from '#application/job/finalize-scan-draft.use-case'
import { ImportProducts } from '#application/fridge/import-products.use-case'

export default class ProductController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      ListProducts,
      async () => {
        const { location, expiringWithinDays } =
          await ctx.request.validateUsing(listProductsValidator)
        const products = await ctx.containerResolver.make('fridge.products')

        const result = await new ListProducts(products).execute({
          householdId: ctx.household.id,
          location,
          expiringWithinDays,
        })
        ctx.response.json({ products: result.map(toProductDto) })
      },
      { action: 'fridge.get_products' },
    )
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      CreateProduct,
      async () => {
        const payload = await ctx.request.validateUsing(createProductValidator)
        const products = await ctx.containerResolver.make('fridge.products')
        const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
        const clock = await ctx.containerResolver.make('shared.clock')

        const result = await new CreateProduct(products, idGenerator, clock).execute({
          householdId: ctx.household.id,
          ...payload,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(201).json({ product: toProductDto(result.value) })
        return result
      },
      { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.id : undefined) },
    )
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      GetProduct,
      async () => {
        const products = await ctx.containerResolver.make('fridge.products')
        const product = await new GetProduct(products).execute({
          householdId: ctx.household.id,
          productId: ctx.params.id,
        })
        if (!product) {
          const { status, body } = serializeError('product_not_found')
          ctx.response.status(status).json(body)
          return { failed: true }
        }
        ctx.response.json({ product: toProductDto(product) })
        return { failed: false }
      },
      { isError: (r) => r.failed },
    )
  }

  async update(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      UpdateProduct,
      async () => {
        const payload = await ctx.request.validateUsing(updateProductValidator)
        const products = await ctx.containerResolver.make('fridge.products')
        const clock = await ctx.containerResolver.make('shared.clock')

        const result = await new UpdateProduct(products, clock).execute({
          householdId: ctx.household.id,
          productId: ctx.params.id,
          ...payload,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json({ product: toProductDto(result.value) })
        return result
      },
      { isError: (r) => !r.ok },
    )
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      DeleteProduct,
      async () => {
        const products = await ctx.containerResolver.make('fridge.products')
        const result = await new DeleteProduct(products).execute({
          householdId: ctx.household.id,
          productId: ctx.params.id,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.status(204).send('')
        return result
      },
      { isError: (r) => !r.ok },
    )
  }

  async recordOutcome(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      RecordProductOutcome,
      async () => {
        const payload = await ctx.request.validateUsing(recordProductOutcomeValidator)
        const products = await ctx.containerResolver.make('fridge.products')
        const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
        const clock = await ctx.containerResolver.make('shared.clock')

        const result = await new RecordProductOutcome(products, idGenerator, clock).execute({
          householdId: ctx.household.id,
          userId: user.id,
          productId: ctx.params.id,
          ...payload,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json({
          product: result.value.product ? toProductDto(result.value.product) : null,
          outcome: toProductOutcomeDto(result.value.outcome),
        })
        return result
      },
      { action: 'fridge.record_product_outcome', isError: (r) => !r.ok },
    )
  }

  async outcomeStats(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', GetProductOutcomeStats, async () => {
      const { days } = await ctx.request.validateUsing(productOutcomeStatsValidator)
      const stats = await ctx.containerResolver.make('fridge.outcomeStats')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new GetProductOutcomeStats(stats, clock).execute({
        householdId: ctx.household.id,
        days,
      })
      ctx.response.json({ stats: toProductOutcomeStatsDto(result) })
    })
  }

  async expiringSoon(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', GetExpiringSoonProducts, async () => {
      const { days } = await ctx.request.validateUsing(expiringSoonValidator)
      const products = await ctx.containerResolver.make('fridge.products')
      const result = await new GetExpiringSoonProducts(products).execute({
        householdId: ctx.household.id,
        days: days ?? 3,
      })
      ctx.response.json({ products: result.map(toProductDto) })
    })
  }

  async importProducts(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      ImportProducts,
      async () => {
        const payload = await ctx.request.validateUsing(importProductsValidator)
        const scanDrafts = await ctx.containerResolver.make('job.scanDrafts')
        const draft = payload.draftId
          ? await new GetScanDraft(scanDrafts).execute({
              householdId: ctx.household.id,
              draftId: payload.draftId,
            })
          : null
        if (payload.draftId && (!draft || draft.kind !== 'fridge')) {
          const { status, body } = serializeError('draft_not_found')
          ctx.response.status(status).json(body)
          return { ok: false as const, error: 'draft_not_found' as const }
        }
        const products = await ctx.containerResolver.make('fridge.products')
        const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
        const clock = await ctx.containerResolver.make('shared.clock')

        const result = await new ImportProducts(products, idGenerator, clock).execute({
          householdId: ctx.household.id,
          items: payload.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category ?? null,
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

        ctx.response.status(201).json({ products: result.value.products.map(toProductDto) })
        return result
      },
      { isError: (r) => !r.ok, action: 'fridge.import' },
    )
  }

  async lookup(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', LookupProduct, async () => {
      const { barcode } = await ctx.request.validateUsing(lookupProductValidator)
      const lookupPort = await ctx.containerResolver.make('fridge.productLookup')
      const result = await new LookupProduct(lookupPort).execute({ barcode })
      ctx.response.json({ result })
    })
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      { name: 'GetProductImage' },
      async () => {
        const products = await ctx.containerResolver.make('fridge.products')
        const product = await new GetProduct(products).execute({
          householdId: ctx.household.id,
          productId: ctx.params.id,
        })
        if (!product || !product.imageKey) {
          const { status, body } = serializeError('image_not_found')
          ctx.response.status(status).json(body)
          return { failed: true }
        }

        const storage = await ctx.containerResolver.make('shared.storage')
        const file = await storage.read(product.imageKey)
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
