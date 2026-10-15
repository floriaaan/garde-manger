import { resolveBinding } from '#presentation/shared/resolve-binding'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Household } from '#domain/identity/household.aggregate'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    household: Household
  }
}

/**
 * Attached to route groups scoped to a household's own data (fridge,
 * receipts, shopping list, recipes — Phase 2 onward). Not used by any
 * Phase 1 route: the household endpoints themselves (create/join/mine) must
 * keep working for a user who has no household yet.
 */
export default class HouseholdRequiredMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = requireAuthenticatedUser(ctx)
    const households = await resolveBinding(ctx, 'identity.households')
    const household = await households.findByUserId(user.id)

    if (!household) {
      const { status, body } = serializeError('no_household')
      ctx.response.status(status).json(body)
      return
    }

    ctx.household = household
    return next()
  }
}
