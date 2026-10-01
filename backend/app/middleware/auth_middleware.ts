import {
  diagnosticAttributes,
  errorCode,
  errorStatus,
  failureLevel,
} from '#domain/shared/log-diagnostic'
import { loggedExceptions } from '#presentation/shared/trace-action'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'

/**
 * Registered globally in kernel.ts (router.use, not a named middleware) so
 * `ctx.authenticatedUser` is always set — to `null` when there's no valid
 * session — before any controller runs.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const cookie = ctx.request.header('cookie')
    if (!cookie) {
      ctx.authenticatedUser = null
      return next()
    }

    const session = await app.container.make('identity.session')
    try {
      ctx.authenticatedUser = await session.resolve(cookie)
    } catch (error) {
      const code = errorCode(error, 'session_resolution_failed')
      const level = failureLevel(code, errorStatus(error))
      ctx.logger[level](
        {
          'app.operation': 'identity.resolve_session',
          'error.code': code,
          'event.outcome': level === 'error' ? 'failure' : 'refused',
          ...(level === 'error' ? diagnosticAttributes(error) : {}),
        },
        'session resolution failed',
      )
      if (error && typeof error === 'object') loggedExceptions.set(error, ctx)
      throw error
    }
    return next()
  }
}
