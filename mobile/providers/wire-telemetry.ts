import { queryClient } from '../src/application/shared/query-client.js'
import type { Session } from '../src/domain/identity/session.js'
import type { Household } from '../src/domain/identity/household.js'
import { telemetry } from '../src/infrastructure/telemetry/telemetry.js'
import { configureTelemetry } from '../src/application/shared/telemetry.js'

/**
 * Same role as `create-connector.ts` — the wiring from the domain-facing
 * `TelemetryPort` to the real infrastructure client lives here, outside
 * `src/`, so nothing under `src/presentation` ever imports infrastructure
 * directly (cf. docs/adr/0002).
 */
export function wireTelemetry(): void {
  telemetry.configureContext(() => ({
    userId: queryClient.getQueryData<Session | null>(['session'])?.user.id,
    householdId: queryClient.getQueryData<Household | null>(['household'])?.id,
  }))
  configureTelemetry(telemetry)
}
