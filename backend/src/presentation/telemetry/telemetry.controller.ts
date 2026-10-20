import { resolveBinding } from '#presentation/shared/resolve-binding'
import type { HttpContext } from '@adonisjs/core/http'
import { getAuthenticatedUser } from '#presentation/shared/auth-context'
import type { RelayedTelemetrySignal } from '#domain/shared/interfaces/telemetry-relay.interface'

const SIGNALS: RelayedTelemetrySignal[] = ['traces', 'logs']

/**
 * OTLP/JSON ingestion for the mobile app — the only route by which a phone's
 * telemetry reaches the collector.
 *
 * Answers 202 before the batch has been forwarded. The app must never wait on
 * the observability stack, and the backend must never fail a request because
 * of it: forwarding is started and explicitly not awaited.
 */
export default class TelemetryController {
  async ingest(ctx: HttpContext) {
    const relay = await resolveBinding(ctx, 'telemetry.relay')

    // 404 rather than 503: a disabled relay is not a transient failure, and
    // the app uses this to stop trying for the rest of the session.
    if (!relay.enabled) return ctx.response.status(404).json({ error: { type: 'not_found' } })

    const signal = ctx.params.signal as RelayedTelemetrySignal
    if (!SIGNALS.includes(signal)) {
      return ctx.response.status(404).json({ error: { type: 'not_found' } })
    }

    const raw = ctx.request.raw()
    if (raw && Buffer.byteLength(raw) > relay.maxBodyBytes) {
      return ctx.response.status(413).json({ error: { type: 'payload_too_large' } })
    }

    const pseudoUserId = relay.pseudonymize(getAuthenticatedUser(ctx)?.id ?? null)
    // Signed-in clients are rate-limited per account, anonymous ones per IP —
    // the sign-in screen is exactly where telemetry is most useful, so it
    // cannot require a session.
    const quotaKey = pseudoUserId ? `user:${pseudoUserId}` : `ip:${ctx.request.ip()}`
    if (!relay.allow(quotaKey)) {
      return ctx.response.status(429).json({ error: { type: 'too_many_requests' } })
    }

    void relay.forward(signal, ctx.request.body(), { pseudoUserId })
    return ctx.response.status(202).json({ status: 'accepted' })
  }
}
