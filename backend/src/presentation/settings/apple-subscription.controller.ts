import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { InvalidApplePurchaseError } from '#domain/settings/interfaces/apple-subscription-port.interface'
import { SyncAppleSubscription } from '#application/settings/sync-apple-subscription.use-case'

const purchaseValidator = vine.compile(vine.object({ signedTransaction: vine.string().minLength(1).maxLength(100_000) }))
const notificationValidator = vine.compile(vine.object({ signedPayload: vine.string().minLength(1).maxLength(100_000) }))

export default class AppleSubscriptionController {
  async show(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const store = await ctx.containerResolver.make('settings.appleStore')
    if (!store) return this.error(ctx, 'billing_unavailable')
    const households = await ctx.containerResolver.make('identity.households')
    const household = await households.findByUserId(user.id)
    if (!household) return this.error(ctx, 'no_household')
    const subscriptions = await ctx.containerResolver.make('settings.subscriptions')
    return ctx.response.json({ productId: store.productId, appAccountToken: store.accountToken(user.id),
      canPurchase: !await subscriptions.hasActiveSubscription(household.id) })
  }

  async sync(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(purchaseValidator)
    const store = await ctx.containerResolver.make('settings.appleStore')
    if (!store) return this.error(ctx, 'billing_unavailable')
    try {
      const result = await new SyncAppleSubscription(store,
        await ctx.containerResolver.make('settings.appleSubscriptions'),
        await ctx.containerResolver.make('identity.households'),
        await ctx.containerResolver.make('shared.clock'),
      ).execute({ userId: user.id, signedTransaction: payload.signedTransaction })
      if (!result.ok) return this.error(ctx, result.error)
      return ctx.response.json(result.value)
    } catch (error) {
      if (error instanceof InvalidApplePurchaseError) return this.error(ctx, 'invalid_apple_purchase')
      // Do not finish the native transaction on an API/DB outage: it can replay.
      ctx.logger.error({ err: error }, 'Apple subscription verification unavailable')
      return ctx.response.status(503).json({ error: { type: 'apple_verification_unavailable', message: 'Validation Apple indisponible. Réessaie la restauration des achats.' } })
    }
  }

  async notification(ctx: HttpContext) {
    const store = await ctx.containerResolver.make('settings.appleStore')
    if (!store) return this.error(ctx, 'billing_unavailable')
    const payload = await ctx.request.validateUsing(notificationValidator)
    try {
      const entitlement = await store.verifyNotification(payload.signedPayload)
      if (entitlement) {
        const subscriptions = await ctx.containerResolver.make('settings.appleSubscriptions')
        await subscriptions.update(entitlement)
      }
      return ctx.response.json({ ok: true })
    } catch (error) {
      if (error instanceof InvalidApplePurchaseError) return ctx.response.status(401).json({ error: { type: 'invalid_apple_purchase' } })
      throw error // 5xx asks Apple to retry; no acknowledgement of lost updates.
    }
  }

  private error(ctx: HttpContext, error: string) {
    const { status, body } = serializeError(error)
    return ctx.response.status(status).json(body)
  }
}
