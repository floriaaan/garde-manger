import { traceAction } from '#presentation/shared/trace-action'
import router from '@adonisjs/core/services/router'
import type { HttpContext } from '@adonisjs/core/http'

const SessionController = () => import('./session.controller.js')
const AuthMethodsController = () => import('./auth-methods.controller.js')

async function toFetchRequest(ctx: HttpContext): Promise<Request> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(ctx.request.headers())) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  const method = ctx.request.method()
  const hasBody = method !== 'GET' && method !== 'HEAD'

  return new Request(ctx.request.completeUrl(true), {
    method,
    headers,
    body: hasBody ? (ctx.request.raw() ?? undefined) : undefined,
  })
}

async function sendFetchResponse(response: Response, ctx: HttpContext): Promise<void> {
  ctx.response.status(response.status)
  response.headers.forEach((value, key) => ctx.response.header(key, value))
  ctx.response.send(Buffer.from(await response.arrayBuffer()))
}

/**
 * better-auth owns everything under `/api/auth/*` (email/password sign-up &
 * sign-in, OIDC callback, sign-out) via its own Fetch-API handler — this
 * only bridges Adonis's Node request/response into a `Request`/`Response`
 * pair. Resolves `identity.authHandler` from the container rather than
 * importing `#infrastructure/auth/better-auth/instance` directly — this
 * file lives in `src/presentation`, which the dependency-cruiser boundary
 * rule (Task 11) forbids from depending on `src/infrastructure` (cf.
 * docs/adr/0002). Uses `ctx.request.raw()` rather than the live Node
 * stream, since `bodyparser_middleware` has already consumed the original
 * `IncomingMessage` by the time this route runs.
 */
// Registered ahead of the `/api/auth/*` catch-all below — Adonis matches
// routes in registration order, so this app-owned endpoint must win over
// better-auth's wildcard bridge.
router.get('/api/auth/methods', [AuthMethodsController, 'index'])

router.get('/api/session', [SessionController, 'show'])

router.any('/api/auth/*', async (ctx: HttpContext) => {
  const authHandler = await ctx.containerResolver.make('identity.authHandler')
  const execute = async () => {
    const response = await authHandler(await toFetchRequest(ctx))
    let error: unknown
    if (!response.ok && ctx.request.url().split('?')[0] === '/api/auth/get-session') {
      try {
        const body = await response.clone().json()
        error = { code: body.code ?? body.error?.type, status: response.status }
      } catch { /* Non-JSON failures retain the stable HTTP status fallback. */ }
    }
    await sendFetchResponse(response, ctx)
    return { ok: response.ok, error }
  }
  if (ctx.request.url().split('?')[0] === '/api/auth/get-session') {
    return traceAction(ctx, 'identity', { name: 'GetSession' }, execute, {
      isError: (response) => !response.ok, action: 'identity.get_session',
    })
  }
  await execute()
})
