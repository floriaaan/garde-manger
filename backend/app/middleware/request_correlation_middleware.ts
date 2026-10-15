import { diagnosticAttributes, errorCode, errorStatus, failureLevel } from '#domain/shared/log-diagnostic'
import { completedActionLogs, requestLogContext } from '#presentation/shared/request-log-context'
import { loggedExceptions } from '#presentation/shared/trace-action'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RequestCorrelationMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const incoming = ctx.request.header('x-request-id')
    if (incoming && !/^[A-Za-z0-9_-]{1,64}$/.test(incoming)) {
      delete ctx.request.request.headers['x-request-id']
    }
    const requestId = ctx.request.id()
    if (requestId) ctx.response.header('x-request-id', requestId)
    const startedAt = performance.now()
    let thrown = false
    let failure: unknown
    try {
      return await next()
    } catch (error) {
      thrown = true
      failure = error
      throw error
    } finally {
      const status = thrown ? errorStatus(failure) ?? 500 : ctx.response.getStatus()
      const path = ctx.request.url().split('?')[0]
      // Health probes and successful telemetry transport are not business actions.
      const noise = path === '/health' || (path?.startsWith('/api/telemetry/') && status < 400)
      if (
        !noise &&
        !completedActionLogs.has(ctx) &&
        !(failure && typeof failure === 'object' && loggedExceptions.get(failure) === ctx)
      ) {
        const failed = thrown || status >= 400
        const code = failed ? errorCode(failure, `http_${status}`) : undefined
        const level = failed ? failureLevel(code!, status) : 'info'
        ctx.logger[level]({
          ...requestLogContext(ctx),
          action: 'http.request',
          'app.operation': 'http.request',
          durationMs: Math.round(performance.now() - startedAt),
          'http.response.status_code': status,
          'event.outcome': failed ? (level === 'error' ? 'failure' : 'refused') : 'success',
          'error.code': code,
          ...(thrown ? diagnosticAttributes(failure) : {}),
        }, 'request completed')
        if (failure && typeof failure === 'object') loggedExceptions.set(failure, ctx)
      }
    }
  }
}
