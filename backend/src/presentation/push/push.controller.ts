import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { traceAction } from '#presentation/shared/trace-action'
import { RegisterPushToken } from '#application/push/register-push-token.use-case'
import { UnregisterPushToken } from '#application/push/unregister-push-token.use-case'
import { registerPushTokenValidator, unregisterPushTokenValidator } from './push.validator.js'

export default class PushController {
  async register(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'push',
      RegisterPushToken,
      async () => {
        const payload = await ctx.request.validateUsing(registerPushTokenValidator)
        const [tokens, idGenerator] = await Promise.all([
          ctx.containerResolver.make('push.tokens'),
          ctx.containerResolver.make('shared.idGenerator'),
        ])
        await new RegisterPushToken(tokens, idGenerator).execute({ userId: user.id, ...payload })
        ctx.response.status(204).send('')
      },
      { action: 'push.register' },
    )
  }

  async unregister(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'push',
      UnregisterPushToken,
      async () => {
        const payload = await ctx.request.validateUsing(unregisterPushTokenValidator)
        const tokens = await ctx.containerResolver.make('push.tokens')
        await new UnregisterPushToken(tokens).execute({ userId: user.id, token: payload.token })
        ctx.response.status(204).send('')
      },
      { action: 'push.unregister' },
    )
  }
}
