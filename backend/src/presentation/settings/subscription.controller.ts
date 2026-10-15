import { resolveBinding } from '#presentation/shared/resolve-binding'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import { StartSubscriptionCheckout } from '#application/settings/start-subscription-checkout.use-case'
import { OpenBillingPortal } from '#application/settings/open-billing-portal.use-case'

function billingConfigured(): boolean {
  return (
    env.get('INSTANCE_MODE', 'self-hosted') === 'hosted' &&
    Boolean(env.get('STRIPE_SECRET_KEY', '')) &&
    Boolean(env.get('STRIPE_PRICE_ID', ''))
  )
}

/** Both endpoints answer `{ url }`: a Stripe-hosted page the mobile app opens in a browser (docs/adr/0015). */
export default class SubscriptionController {
  checkout(ctx: HttpContext) {
    return this.open(
      ctx,
      StartSubscriptionCheckout,
      'settings.startSubscriptionCheckout',
      'settings.start_checkout',
    )
  }

  portal(ctx: HttpContext) {
    return this.open(
      ctx,
      OpenBillingPortal,
      'settings.openBillingPortal',
      'settings.open_billing_portal',
    )
  }

  private async open(
    ctx: HttpContext,
    UseCase: typeof StartSubscriptionCheckout | typeof OpenBillingPortal,
    binding: 'settings.startSubscriptionCheckout' | 'settings.openBillingPortal',
    action: string,
  ) {
    const user = requireAuthenticatedUser(ctx)
    if (!billingConfigured()) {
      const { status, body } = serializeError('billing_unavailable')
      return ctx.response.status(status).json(body)
    }

    return traceAction(
      ctx,
      'settings',
      UseCase,
      async () => {
        const useCase = await resolveBinding(ctx, binding)
        const result = await useCase.execute({ userId: user.id })

        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json(result.value)
        return result
      },
      { action, isError: (r) => !r.ok },
    )
  }
}
