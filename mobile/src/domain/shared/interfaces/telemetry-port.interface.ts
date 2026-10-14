/**
 * Presentation-layer surface of the mobile telemetry client — the domain
 * boundary between "record that something went wrong" and the actual OTLP
 * client living in `infrastructure/telemetry/telemetry.ts`. `src/presentation`
 * depends on this interface, never on the infrastructure module directly
 * (the `presentation-must-not-depend-on-infrastructure` boundary rule, cf.
 * docs/adr/0002) — `providers/` wires the real implementation in at boot.
 */
export interface TelemetryPort {
  recordEvent?(
    operation: string,
    outcome: 'started' | 'completed' | 'success',
    options?: { attributes?: Record<string, string | number | boolean> },
  ): void
  recordError(
    message: string,
    options?: { error?: unknown; attributes?: Record<string, string | number | boolean>; level?: 'info' | 'warn' | 'error' },
  ): void
}
