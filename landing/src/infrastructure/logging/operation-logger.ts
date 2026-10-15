import type { OperationLogger } from '../../domain/interfaces/operation-logger.js'

/** The only console sink; an unavailable sink must never change an operation's result. */
export const operationLogger: OperationLogger = {
  async run(operation, fn, parameters) {
    const startedAt = performance.now()
    const context = {
      'service.name': 'garde-manger-landing',
      'client.platform': 'landing',
      'app.operation': operation,
      // Public, anonymous operations: no identity or server trace is available here.
      userId: null,
      householdId: null,
      request_id: null,
      trace_id: null,
      entityId: null,
      ...(parameters?.locale && ['fr', 'en'].includes(parameters.locale) ? { 'business.locale': parameters.locale } : {}),
    }
    const emit = (level: 'info' | 'error', attributes: Record<string, unknown>) => {
      try {
        console[level]('operation completed', {
          ...context, ...attributes, durationMs: Math.round(performance.now() - startedAt),
        })
      } catch { /* Logging must not alter business behavior. */ }
    }
    try {
      const result = await fn()
      emit('info', { 'event.outcome': 'success' })
      return result
    } catch (error) {
      emit('error', {
        'event.outcome': 'failure', 'error.code': 'operation_failed',
        'exception.type': error instanceof TypeError ? 'TypeError' : error instanceof Error ? 'Error' : 'NonErrorThrown',
      })
      throw error
    }
  },
}
