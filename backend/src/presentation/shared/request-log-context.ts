import { trace } from '@opentelemetry/api'
import { safeAttribute, safeBusinessParameters } from '#domain/shared/log-diagnostic'

export interface RequestLogContext {
  authenticatedUser?: { id: string } | null
  household?: { id: string } | null
  params?: Record<string, string | undefined>
  route?: { pattern: string }
  request?: {
    id(): string | null | undefined
    method?(): string
    header?(name: string): string | undefined
    input?(key: string): unknown
  }
}

/** Request-local metadata only; never store an HttpContext in a global singleton. */
export const actionLogContexts = new WeakMap<object, { action: string; useCase: string }>()
export const completedActionLogs = new WeakSet<object>()

export function requestLogContext(ctx?: RequestLogContext | null): Record<string, unknown> {
  const span = trace.getActiveSpan()?.spanContext()
  if (!ctx) return { trace_id: span?.traceId, span_id: span?.spanId }
  const platform = ctx.request?.header?.('x-client-platform')
  const operation = actionLogContexts.get(ctx)
  const input = ctx.request?.input?.bind(ctx.request)
  let parameters: Record<string, string | number | boolean> = {}
  // Invalid/unparsed input must not make error reporting fail as well.
  try {
    if (input) parameters = safeBusinessParameters(input)
  } catch {
    /* No body diagnostics. */
  }
  return {
    request_id: ctx.request?.id() ?? null,
    'client.platform':
      platform && ['ios', 'android', 'web', 'landing'].includes(platform) ? platform : 'unknown',
    trace_id: span?.traceId,
    span_id: span?.spanId,
    userId: ctx.authenticatedUser?.id ?? null,
    householdId: ctx.household?.id ?? null,
    entityId: ctx.params?.id ? safeAttribute('entity.id', ctx.params.id) : null,
    'http.request.method': ctx.request?.method?.(),
    'http.route': ctx.route?.pattern,
    ...(operation ? { ...operation, 'app.operation': operation.action } : {}),
    ...parameters,
  }
}
