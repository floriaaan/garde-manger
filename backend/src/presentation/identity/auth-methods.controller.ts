import type { HttpContext } from '@adonisjs/core/http'
import { traceAction } from '#presentation/shared/trace-action'
import { GetAuthMethods } from '#application/identity/get-auth-methods.use-case'

export default class AuthMethodsController {
  async index(ctx: HttpContext) {
    return traceAction(ctx, 'identity', GetAuthMethods, async () => {
      const provider = await ctx.containerResolver.make('identity.authMethodsProvider')
      const methods = await new GetAuthMethods(provider).execute()
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
