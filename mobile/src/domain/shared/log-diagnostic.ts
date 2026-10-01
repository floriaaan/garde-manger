/** Pure logging policy; mirrored in backend/mobile so each app builds independently. */
export function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const value = error as { status?: unknown; statusCode?: unknown }
  if (typeof value.status === 'number') return value.status
  return typeof value.statusCode === 'number' ? value.statusCode : undefined
}

export function errorCode(error: unknown, fallback = 'unexpected_error'): string {
  const value = typeof error === 'string' ? error
    : error && typeof error === 'object'
      ? ((error as { code?: unknown; type?: unknown }).code ?? (error as { type?: unknown }).type)
      : undefined
  return typeof value === 'string' && /^(?:[a-zA-Z][a-zA-Z0-9_]{0,63}|[0-9A-Z]{5})$/.test(value)
    ? value : fallback
}

const EXPECTED_REFUSALS = new Set([
  'unauthenticated', 'no_household', 'owner_cannot_leave', 'invalid_credentials',
  'UNAUTHORIZED', 'INVALID_EMAIL_OR_PASSWORD', 'SESSION_EXPIRED',
])

export function failureLevel(code: string, status?: number): 'info' | 'warn' | 'error' {
  // Status takes precedence: a 5xx with a misleading business code is still an incident.
  if (status !== undefined && status >= 500) return 'error'
  if (EXPECTED_REFUSALS.has(code)) return 'info'
  return status !== undefined && status >= 400 && status < 500 ? 'warn' : 'error'
}

/** Fail closed for free-form messages: auth/DB errors can interpolate credentials or PII. */
export function diagnosticMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const safe = /^(Network request failed|Failed to fetch|fetch failed|network down|network error|network unreachable|The operation was aborted\.?|This operation was aborted|The user aborted a request\.?|Load failed|Unexpected end of JSON input|Invalid API error response|Session request timed out)$/i
  if (safe.test(value)) return value
  // Canonical messages retain the mechanism without interpolated values.
  for (const [pattern, message] of [
    [/ECONNREFUSED/, 'Connection refused'],
    [/ECONNRESET|Connection terminated unexpectedly/, 'Connection terminated unexpectedly'],
    [/ENOTFOUND|EAI_AGAIN/, 'DNS lookup failed'],
    [/ETIMEDOUT/, 'Connection timed out'],
    [/Unexpected token.*JSON|JSON.*Unexpected token/, 'Invalid JSON response'],
    [/Cannot read properties of (undefined|null)/, 'Cannot read properties of null or undefined'],
  ] as const) {
    if (pattern.test(value)) return message
  }
  if (['Connection refused', 'Connection terminated unexpectedly', 'DNS lookup failed',
    'Connection timed out', 'Invalid JSON response', 'Cannot read properties of null or undefined'].includes(value)) return value
  return '[redacted diagnostic message]'
}

export function diagnosticAttributes(error: unknown, depth = 0): Record<string, string> {
  const value = error && typeof error === 'object'
    ? error as { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown } : {}
  const type = typeof value.name === 'string' && /^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(value.name)
    ? value.name : error && typeof error === 'object' ? 'StructuredError' : 'NonErrorThrown'
  const output: Record<string, string> = { 'exception.type': type }
  const message = diagnosticMessage(value.message ?? (typeof error === 'string' ? error : undefined))
  if (message) output['exception.message'] = message
  if (typeof value.stack === 'string') {
    // Keep frame positions, never the message, absolute paths, URLs or arguments.
    const frames = value.stack.split('\n').slice(1, 21).map((frame) => {
      const position = frame.replace(/\?[^:]*?(?=:\d+:\d+\)?$)/, '').match(
        /([A-Za-z0-9_.-]+\.(?:[cm]?[jt]sx?|bundle)):(\d+):(\d+)\)?$/,
      )
      return position ? `at ${position[1]}:${position[2]}:${position[3]}` : 'at [redacted frame]'
    })
    if (frames.length) output['exception.stacktrace'] = frames.join('\n')
  }
  if (value.cause !== undefined && depth < 3) {
    output['exception.cause'] = JSON.stringify({
      code: errorCode(value.cause), ...diagnosticAttributes(value.cause, depth + 1),
    })
  }
  return output
}

/** Enforced before client emission and again at the relay. */
export const LOG_SIGNAL_ATTRIBUTES = new Set([
  'http.request.method', 'http.response.status_code', 'url.path',
  'error.type', 'error.code', 'exception.type', 'exception.message',
  'exception.stacktrace', 'exception.cause', 'network.connection.type',
  'app.screen', 'app.operation', 'app.telemetry.dropped', 'action',
  'entity.id', 'app.storage_key', 'event.outcome', 'event.occurrences', 'request_id',
])

export function safeOperation(value: string): string {
  const operation = value.split(/[?#]/)[0] ?? 'unspecified'
  return /^[A-Za-z0-9_. /:-]{1,160}$/.test(operation)
    ? operation.replace(/\/[0-9a-f-]{16,}(?=\/|$)/gi, '/:id') : 'redacted_operation'
}

/** Revalidate diagnostic strings supplied by an untrusted client. */
export function sanitizeCause(text: string, depth = 0): string {
  if (depth >= 3) return '[cause depth limit]'
  try {
    const value = JSON.parse(text)
    const diagnostics = diagnosticAttributes({
      name: value['exception.type'], message: value['exception.message'],
      stack: typeof value['exception.stacktrace'] === 'string' ? `Error\n${value['exception.stacktrace']}` : undefined,
    })
    return JSON.stringify({
      code: errorCode(value), ...diagnostics,
      ...(typeof value['exception.cause'] === 'string'
        ? { 'exception.cause': sanitizeCause(value['exception.cause'], depth + 1) } : {}),
    })
  } catch { return '[redacted cause]' }
}

export function safeAttribute(key: string, value: string): string {
  if (['action', 'app.operation', 'url.path', 'app.screen'].includes(key)) return safeOperation(value)
  if (key === 'exception.message') return diagnosticMessage(value) ?? '[redacted diagnostic message]'
  if (key === 'exception.stacktrace') return diagnosticAttributes({ stack: `Error\n${value}` })['exception.stacktrace'] ?? ''
  if (key === 'exception.cause') return sanitizeCause(value)
  if (['error.code', 'error.type', 'exception.type', 'request_id', 'entity.id', 'app.storage_key'].includes(key)) {
    return /^[A-Za-z0-9_.:-]{1,64}$/.test(value) ? value : '[redacted]'
  }
  return value
}
