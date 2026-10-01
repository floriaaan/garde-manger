import { diagnosticAttributes, errorCode, errorStatus, failureLevel } from '#domain/shared/log-diagnostic'

export const loggedExceptions = new WeakMap<object, object>()

type LogFn = (mergingObject: Record<string, unknown>, message: string) => void

/**
 * The narrow slice of `HttpContext` this needs — a real request satisfies it
 * structurally (no cast at call sites), and a unit test can pass a plain
 * object instead of constructing a real HttpContext.
 */
export interface ActionContext {
  logger: { info: LogFn; warn: LogFn; error: LogFn }
  authenticatedUser: { id: string } | null
  household: { id: string } | null | undefined
  params: Record<string, string | undefined>
  request?: { id(): string | null | undefined }
  response?: { getStatus(): number }
}

export interface TraceActionOptions<T> {
  /**
   * `true` when `fn`'s result represents a business failure (e.g. `!result.ok`
   * on a `Result`, or a manually-set `{ failed: true }`). Omit when the
   * action has no failure branch — outcome is then always `success` unless
   * `fn` throws.
   */
  isError?: (result: T) => boolean
  /** Escalate a refusal when this operation's context makes it unexpected. 5xx stays ERROR. */
  failureLevel?: 'info' | 'warn' | 'error'
  /** Resolves the id of the entity the action produced/targeted, when it is not already the route's `:id` param. */
  entityId?: (result: T) => string | undefined
  /**
   * Overrides the auto-derived `<domain>.<verb_noun>` label. Use only where
   * the UseCase's own name would stutter or drift from the equivalent
   * mobile action name (e.g. `ListProducts` → `fridge.get_products`, not
   * `fridge.list_products`) — `useCase` in the log line still carries the
   * real class name regardless, so this never hides which class ran.
   */
  action?: string
}

function toSnakeCase(pascalCase: string): string {
  return pascalCase.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

/**
 * Wraps a controller action's body so every business action — read or
 * write — emits exactly one structured log line, with `trace_id`/`span_id`
 * already injected by `PinoInstrumentation` (see `instrumentation.ts`) and
 * mirrored to the OTLP logs pipeline. Never changes what `fn` returns or
 * throws — only observes it.
 */
export async function traceAction<T>(
  ctx: ActionContext,
  domain: string,
  useCase: { name: string },
  fn: () => Promise<T>,
  opts?: TraceActionOptions<T>,
): Promise<T> {
  const startedAt = performance.now()
  const action = opts?.action ?? `${domain}.${toSnakeCase(useCase.name)}`
  const base = {
    action,
    'app.operation': action,
    request_id: ctx.request?.id(),
    useCase: useCase.name,
    entityId: ctx.params.id,
  }

  try {
    const result = await fn()
    const failed = opts?.isError?.(result) ?? false
    const resultError = failed && result && typeof result === 'object' && 'error' in result ? result.error : undefined
    const code = failed ? errorCode(resultError, `http_${ctx.response?.getStatus() ?? 400}`) : undefined
    const status = ctx.response?.getStatus() ?? 400
    const level = failed ? (status >= 500 ? 'error' : opts?.failureLevel ?? failureLevel(code!, status)) : 'info'
    ctx.logger[level](
      {
        ...base,
        entityId: base.entityId ?? opts?.entityId?.(result),
        durationMs: Math.round(performance.now() - startedAt),
        outcome: failed ? 'error' : 'success',
        'event.outcome': failed ? (level === 'error' ? 'failure' : 'refused') : 'success',
        'error.code': code,
        ...(failed ? { 'http.response.status_code': status } : {}),
      },
      `action:${action}`,
    )
    return result
  } catch (error) {
    const status = errorStatus(error) ?? 500
    const code = errorCode(error, 'unexpected_error')
    const level = status >= 500 ? 'error' : opts?.failureLevel ?? failureLevel(code, status)
    ctx.logger[level](
      {
        ...base,
        durationMs: Math.round(performance.now() - startedAt),
        outcome: 'error',
        'event.outcome': level === 'error' ? 'failure' : 'refused',
        'error.code': code,
        'http.response.status_code': status,
        errorType: diagnosticAttributes(error)['exception.type'],
        ...(level === 'error' ? diagnosticAttributes(error) : {}),
      },
      `action:${action}`,
    )
    if (error && typeof error === 'object') loggedExceptions.set(error, ctx)
    throw error
  }
}
