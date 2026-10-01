import {
  diagnosticAttributes,
  errorCode,
  errorStatus,
  failureLevel,
} from '#domain/shared/log-diagnostic'
import { loggedExceptions } from './trace-action.js'
import app from '@adonisjs/core/services/app'
import { ExceptionHandler as BaseExceptionHandler } from '@adonisjs/core/http'

type RenderErrorAsJSON = BaseExceptionHandler['renderErrorAsJSON']
type RenderValidationErrorAsJSON = BaseExceptionHandler['renderValidationErrorAsJSON']

/**
 * Only reached for exceptions that escape a controller uncaught. Expected
 * domain/application errors never get here — controllers convert
 * `Result.err(...)` via `error-serializer.ts` and send a normal response
 * before returning. VineJS validation errors and AdonisJS's own
 * self-handling exceptions (route-not-found, etc.) are also handled by the
 * base class before this method runs.
 *
 * `requireAuthenticatedUser`'s 401 is the one exception to "expected errors
 * never get here": it throws deliberately, with its own `status`/`code`,
 * from every controller that guards a route. That shape must reach the
 * client the same way in dev and in prod — Youch's debug JSON (no `.error`
 * key) is only useful for a genuinely unexpected 500, and swallowing a
 * routine 401 into it is what silently broke every mobile screen's error
 * message in local dev, with no other symptom than "the button does
 * nothing".
 */
export class HttpExceptionHandler extends BaseExceptionHandler {
  protected debug = !app.inProduction

  async report(error: unknown, ctx: Parameters<BaseExceptionHandler['report']>[1]) {
    if (error && typeof error === 'object' && loggedExceptions.get(error) === ctx) return
    if (!this.shouldReport(this.toHttpError(error))) return
    const status = errorStatus(error) ?? 500
    const code = errorCode(error)
    const level = failureLevel(code, status)
    ctx.logger[level](
      {
        'app.operation': (ctx.request.url().split('?')[0] ?? '').startsWith('/api/auth/get-session')
          ? 'identity.get_session'
          : `${ctx.request.method()} ${ctx.route?.pattern ?? 'unmatched_route'}`,
        request_id: ctx.request.id(),
        'event.outcome': level === 'error' ? 'failure' : 'refused',
        'error.code': code,
        'http.response.status_code': status,
        ...(level === 'error' ? diagnosticAttributes(error) : {}),
      },
      'request failed',
    )
  }

  async renderErrorAsJSON(...args: Parameters<RenderErrorAsJSON>): ReturnType<RenderErrorAsJSON> {
    const [error, ctx] = args

    // Most escaped exceptions carry a numeric `status` (Adonis convention).
    // better-auth's `APIError` (thrown by `auth.api.*` calls made directly
    // from application code, bypassing the HTTP bridge in auth.routes.ts)
    // is the exception: its `status` is a string status-code key (e.g.
    // "UNPROCESSABLE_ENTITY") and the numeric code lives in `statusCode`.
    const statusCode = (error as unknown as { statusCode?: unknown }).statusCode
    const isShapedError = typeof error.status === 'number' || typeof statusCode === 'number'

    // A truly unexpected exception (no known status/code) still gets Youch's
    // rich debug page in dev — that one really is "unexpected", and the
    // stack trace is worth more there than a bare `internal_error`.
    if (!isShapedError && this.isDebuggingEnabled(ctx)) return super.renderErrorAsJSON(error, ctx)

    const status =
      typeof error.status === 'number'
        ? error.status
        : typeof statusCode === 'number'
          ? statusCode
          : 500

    ctx.response.status(status).send({
      error: { type: error.code ?? 'internal_error', message: error.message },
    })
  }

  async renderValidationErrorAsJSON(
    ...args: Parameters<RenderValidationErrorAsJSON>
  ): ReturnType<RenderValidationErrorAsJSON> {
    const [error, ctx] = args
    ctx.response.status(error.status).send({
      error: { type: 'validation_failed', message: 'Validation failed.', details: error.messages },
    })
  }
}
