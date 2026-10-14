import type { HttpContext } from '@adonisjs/core/http'
import { traceAction } from '#presentation/shared/trace-action'
import { GetAuthMethods } from '#application/identity/get-auth-methods.use-case'

export default class AuthMethodsController {
  async index(ctx: HttpContext) {
    return traceAction(ctx, 'identity', GetAuthMethods, async () => {
      const getAuthMethods = await ctx.containerResolver.make('identity.getAuthMethods')
      const methods = await getAuthMethods.execute()
      ctx.response.json({
        methods: methods.map((m) => ({
          id: m.id,
          enabled: m.enabled,
          label: m.label,
          resetAvailable: m.resetAvailable,
        })),
      })
    })
  }
}
