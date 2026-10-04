import { safeOperation } from '../../domain/shared/log-diagnostic.js'
import { Platform } from 'react-native'
import { Result } from '../../domain/shared/result.js'
import { telemetry } from '../telemetry/telemetry.js'
import { authClient } from '../auth/auth-client.js'
import { queryClient } from '../../application/shared/query-client.js'
import { showToast } from '../../application/shared/toast.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import { getServerUrl } from '../../application/shared/server-config.js'

const NETWORK_ERROR_MESSAGE = 'Impossible de contacter le serveur.'

/**
 * Every screen's own error handling is best-effort (an inline message, or
 * sometimes none at all for a background refetch) — this is the one place
 * that always fires, regardless of which screen or query is asking, so a
 * dead server reads as one friendly toast everywhere instead of either
 * silence or, worse, an unhandled rejection reaching RN's dev redbox.
 */
function networkErrorResult<T>(): Result<T, ApiError> {
  showToast(NETWORK_ERROR_MESSAGE)
  return Result.err({ type: 'network_error', message: NETWORK_ERROR_MESSAGE })
}

/** Names the span/log with the business action it belongs to, and carries whatever entity ids the caller already knows — never free text. */
export interface ActionContext {
  action?: string
  attributes?: Record<string, string | number | boolean>
}

/** Only a confirmed authentication refusal invalidates the local session. */
function handleUnauthenticated() {
  // Cancel an older session read before it can restore a revoked session.
  void queryClient.cancelQueries({ queryKey: ['session'] })
  queryClient.setQueryData(['session'], null)
  authClient.signOut().catch(() => {})
}

/**
 * Wraps one outgoing call in a client span and injects `traceparent`, so the
 * span the backend opens for the same request is a child of this one. That
 * single header is the whole mobile→backend correlation mechanism: no custom
 * id, no custom protocol, just W3C trace context.
 *
 * Telemetry is entirely out of the request's way — `startClientSpan` returns
 * `null` when it is off, and `end()` cannot throw — so a missing or broken
 * observability stack changes nothing about what this function returns.
 */
async function tracedFetch(
  path: string,
  method: string,
  init: RequestInit,
  context?: ActionContext,
): Promise<{ response: Response; span: ReturnType<typeof telemetry.startClientSpan> }> {
  const apiUrl = getServerUrl()
  const operation = safeOperation(context?.action ?? `${method} ${path.split('?')[0]}`)
  const span = telemetry.startClientSpan(operation, {
    'app.operation': operation,
    'http.request.method': method,
    // The path, never the query string: it is where ids and search terms live.
    'url.path': path.split('?')[0],
    ...context?.attributes,
  })

  // React Native's `fetch` keeps no cookie jar across requests — unlike a
  // browser, `credentials: 'include'` alone sends nothing here. better-auth's
  // Expo plugin stores the session cookie itself (SecureStore) exactly for
  // this reason, and `getCookie()` is the documented way to read it back for
  // any request that doesn't go through `authClient`'s own fetch. Without
  // this, every call below is unauthenticated on native, no matter how
  // recently the user signed in.
  //
  // Web never needed this: the browser's own cookie jar already attaches the
  // session cookie via `credentials: 'include'` below. It matters more than
  // "unneeded" — `expo-secure-store`'s web shim doesn't implement
  // `getValueWithKeyAsync` at all, so calling `getCookie()` here on web threw
  // on every single request, silently failing every `apiFetch` call.
  let phase = 'cookie_read_failed'
  try {
    const cookie = Platform.OS === 'web' ? null : await authClient.getCookie()

    const headers = {
      ...(init.headers as Record<string, string>),
      ...(span ? { traceparent: span.traceparent } : null),
      ...(cookie ? { Cookie: cookie } : null),
    }

    phase = 'network_error'
    const response = await fetch(`${apiUrl}${path}`, { ...init, headers })
    span?.end({
      attributes: {
        'http.response.status_code': response.status,
        request_id: response.headers?.get('x-request-id') ?? undefined,
        'event.outcome': response.status >= 500 ? 'failure' : response.status >= 400 ? 'refused' : 'success',
      },
      ...(response.status >= 500 ? { error: { code: `http_${response.status}`, name: 'HttpError' } } : {}),
    })
    return { response, span }
  } catch (error) {
    span?.end({ error })
    const attributes = {
      'app.operation': operation,
      'error.code': phase,
      'http.request.method': method,
    }
    telemetry.recordError('operation failed', { error, ...(span ? { span } : {}), attributes })
    throw error
  }
}

/** Parsing failures belong to the request's trace and are not transport failures. */
async function readResponse(response: Response, span: ReturnType<typeof telemetry.startClientSpan>, operation: string) {
  try {
    const body = await response.json()
    if (!response.ok && (!body?.error || typeof body.error.type !== 'string')) {
      throw new TypeError('Invalid API error response')
    }
    return body
  } catch (error) {
    const attributes = { 'app.operation': safeOperation(operation), 'error.code': 'invalid_response', 'http.response.status_code': response.status, request_id: response.headers?.get('x-request-id') ?? undefined }
    telemetry.recordError('invalid response', { error, ...(span ? { span } : {}), attributes, level: 'error' })
    throw error
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  context?: ActionContext,
): Promise<Result<T, ApiError>> {
  try {
    const { response, span } = await tracedFetch(
      path,
      init?.method ?? 'GET',
      {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      },
      context,
    )
    // A 204 always means "success, no body" — nothing to parse.
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await readResponse(response, span, context?.action ?? `${init?.method ?? 'GET'} ${path.split('?')[0]}`)
    if (!response.ok) {
      const error = body.error as ApiError
      // Logs qualify business refusals separately from technical HTTP failures.
      telemetry.recordError(`action failed: ${error.type}`, {
        attributes: { 'error.type': error.type, action: context?.action ?? `${init?.method ?? 'GET'} ${path.split('?')[0]}`, 'http.response.status_code': response.status, request_id: response.headers?.get('x-request-id') ?? undefined },
        ...(span ? { span } : null),
      })
      if (response.status === 401 && error.type === 'unauthenticated') handleUnauthenticated()
      return Result.err(error)
    }
    return Result.ok(body as T)
  } catch {
    return networkErrorResult<T>()
  }
}

/**
 * Like `apiFetch`, but for a `FormData` body (the one client→server call
 * that isn't JSON: the receipt-scan image upload). No `Content-Type`
 * header is set — `fetch` derives the multipart boundary from the
 * `FormData` instance itself, and setting it manually would drop that
 * boundary.
 */
export async function apiFetchMultipart<T>(
  path: string,
  formData: FormData,
  context?: ActionContext,
): Promise<Result<T, ApiError>> {
  try {
    const { response, span } = await tracedFetch(
      path,
      'POST',
      { method: 'POST', credentials: 'include', body: formData },
      context,
    )
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await readResponse(response, span, context?.action ?? `POST ${path.split('?')[0]}`)
    if (!response.ok) {
      const error = body.error as ApiError
      telemetry.recordError(`action failed: ${error.type}`, {
        attributes: { 'error.type': error.type, action: context?.action ?? `POST ${path.split('?')[0]}`, 'http.response.status_code': response.status, request_id: response.headers?.get('x-request-id') ?? undefined },
        ...(span ? { span } : null),
      })
      if (response.status === 401 && error.type === 'unauthenticated') handleUnauthenticated()
      return Result.err(error)
    }
    return Result.ok(body as T)
  } catch {
    return networkErrorResult<T>()
  }
}
