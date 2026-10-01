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
    return next()
  }
}
