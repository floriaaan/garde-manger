import type { TelemetryPort } from '../../domain/shared/interfaces/telemetry-port.interface.js'

/**
 * Presentation's only door to telemetry. `providers/` wires the real client
 * in at boot (outside `src/`, per docs/adr/0002) — everything under
 * `src/presentation` calls `getTelemetry()` instead of importing
 * `infrastructure/telemetry/telemetry.js` directly, which the
 * `presentation-must-not-depend-on-infrastructure` boundary rule forbids.
 *
 * Early startup records wait for the provider wiring instead of disappearing.
 * The bounded buffer prevents an unconfigured test or failed boot growing forever.
 */
let port: TelemetryPort | null = null
const pending: ((target: TelemetryPort) => void)[] = []
const buffer = (emit: (target: TelemetryPort) => void) => {
  if (pending.length === 64) pending.shift()
  pending.push(emit)
}
const startupPort: TelemetryPort = {
  recordError: (message, options) => buffer((target) => target.recordError(message, options)),
  recordEvent: (operation, outcome, options) =>
    buffer((target) => target.recordEvent?.(operation, outcome, options)),
}

export function configureTelemetry(telemetry: TelemetryPort): void {
  port = telemetry
  for (const emit of pending.splice(0)) {
    try { emit(telemetry) } catch { /* Logging must not break startup. */ }
  }
}

export function getTelemetry(): TelemetryPort {
  return port ?? startupPort
}
