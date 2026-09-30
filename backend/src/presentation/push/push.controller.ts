import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { traceAction } from '#presentation/shared/trace-action'
import { RegisterPushToken } from '#application/push/register-push-token.use-case'
import { UnregisterPushToken } from '#application/push/unregister-push-token.use-case'
import {
  registerPushTokenValidator,
  registerWebPushValidator,
  unregisterPushTokenValidator,
  unregisterWebPushValidator,
} from './push.validator.js'

// Never allow a client supplied endpoint to turn the push sender into an SSRF proxy.
function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'fcm.googleapis.com' ||
        url.hostname === 'updates.push.services.mozilla.com' ||
        url.hostname === 'web.push.apple.com' ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname))
    )
  } catch {
    return false
  }
}

export default class PushController {
  async webConfig(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const { default: env } = await import('#start/env')
    const enabled =
      env.get('PUSH_ENABLED', true) &&
      !!env.get('WEB_PUSH_VAPID_SUBJECT') &&
      !!env.get('WEB_PUSH_VAPID_PUBLIC_KEY') &&
      !!env.get('WEB_PUSH_VAPID_PRIVATE_KEY')
    return ctx.response.json({ publicKey: enabled ? env.get('WEB_PUSH_VAPID_PUBLIC_KEY') : null })
  }

  async registerWeb(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(registerWebPushValidator)
    if (!allowedPushEndpoint(payload.endpoint)) {
      return ctx.response
        .status(422)
        .json({ type: 'invalid_push_endpoint', message: 'Service push non pris en charge.' })
    }
    const { default: env } = await import('#start/env')
    if (
      !env.get('PUSH_ENABLED', true) ||
      !env.get('WEB_PUSH_VAPID_PUBLIC_KEY') ||
      !env.get('WEB_PUSH_VAPID_PRIVATE_KEY') ||
      !env.get('WEB_PUSH_VAPID_SUBJECT')
    ) {
      return ctx.response
        .status(503)
        .json({ type: 'push_unavailable', message: 'Push Web non configuré.' })
    }
    const tokens = await ctx.containerResolver.make('push.tokens')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
    await tokens.upsertWeb({ id: idGenerator.next(), userId: user.id, ...payload })
    return ctx.response.status(204).send('')
  }

  async unregisterWeb(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const { endpoint } = await ctx.request.validateUsing(unregisterWebPushValidator)
    const tokens = await ctx.containerResolver.make('push.tokens')
    await tokens.deleteForUser(user.id, endpoint)
    return ctx.response.status(204).send('')
  }

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
