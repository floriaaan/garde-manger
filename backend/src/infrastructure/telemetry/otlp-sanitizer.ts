import { LOG_SIGNAL_ATTRIBUTES, safeAttribute, safeOperation } from '#domain/shared/log-diagnostic'
import type {
  TelemetryAttribution,
  RelayedTelemetrySignal,
} from '#domain/shared/interfaces/telemetry-relay.interface'

/**
 * Rewrites an OTLP/JSON batch coming from an untrusted client (the mobile
 * app) into something safe to store.
 *
 * The rule is an *allowlist*, not a denylist. A denylist has to be updated
 * every time someone adds an attribute on the app side and is wrong by
 * default; an allowlist drops the unknown attribute and the worst case is a
 * missing dimension in a dashboard. Sizes are capped for the same reason: a
 * hostile — or merely buggy — client must not be able to fill ClickHouse.
 */

const MAX_RESOURCES = 4
const MAX_SCOPES = 8
const MAX_ITEMS_PER_SCOPE = 512
const MAX_EVENTS_PER_SPAN = 16
const MAX_ATTRIBUTE_LENGTH = 512
const MAX_BODY_LENGTH = 2048

/**
 * Resource-level attributes the app may set. Everything identifying a person
 * or a handset is absent on purpose: `device.model`, `device.id`, IP address,
 * locale and carrier are all either personal data or high-cardinality noise,
 * and none of them has ever been needed to fix a bug that `os.name` +
 * `service.version` could not localise.
 */
const ALLOWED_RESOURCE_ATTRIBUTES = new Set([
  'service.name',
  'service.version',
  'service.build',
  'deployment.environment.name',
  'os.name',
  'os.version',
  'app.session.id',
  'app.telemetry.dropped',
  'telemetry.sdk.name',
  'telemetry.sdk.language',
  'telemetry.sdk.version',
])

/** Span/log attributes the app may set. */
const ALLOWED_SIGNAL_ATTRIBUTES = LOG_SIGNAL_ATTRIBUTES

interface OtlpAttribute {
  key?: unknown
  value?: unknown
}

function truncate(value: string): string {
  return value.length > MAX_ATTRIBUTE_LENGTH ? `${value.slice(0, MAX_ATTRIBUTE_LENGTH)}…` : value
}

/**
 * Keeps only the scalar OTLP value shapes. `arrayValue`/`kvlistValue` are
 * dropped wholesale: nesting is where an unreviewed blob of request data
 * would hide, and nothing the app emits needs it.
 */
function sanitizeValue(value: unknown, key: string): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>

  if (typeof source.stringValue === 'string') return {
    stringValue: ['exception.cause', 'exception.stacktrace'].includes(key)
      ? source.stringValue.slice(0, 8192) : truncate(source.stringValue),
  }
  if (typeof source.boolValue === 'boolean') return { boolValue: source.boolValue }
  if ((typeof source.intValue === 'number' && Number.isSafeInteger(source.intValue))
    || (typeof source.intValue === 'string' && /^-?\d{1,20}$/.test(source.intValue))) {
    return { intValue: source.intValue }
  }
  if (typeof source.doubleValue === 'number' && Number.isFinite(source.doubleValue)) return { doubleValue: source.doubleValue }
  return null
}

function sanitizeAttributes(input: unknown, allowed: Set<string>): OtlpAttribute[] {
  if (!Array.isArray(input)) return []
  const output: OtlpAttribute[] = []
  for (const attribute of input) {
    if (typeof attribute !== 'object' || attribute === null) continue
    const { key, value } = attribute as OtlpAttribute
    if (typeof key !== 'string' || !allowed.has(key)) continue
    const sanitized = sanitizeValue(value, key)
    if (sanitized && 'stringValue' in sanitized) {
      sanitized.stringValue = safeAttribute(key, sanitized.stringValue as string)
    }
    if (sanitized) output.push({ key, value: sanitized })
  }
  return output
}

function stringAttribute(key: string, value: string): OtlpAttribute {
  return { key, value: { stringValue: value } }
}

function sanitizeResource(resource: unknown, attribution: TelemetryAttribution) {
  const attributes = sanitizeAttributes(
    (resource as { attributes?: unknown } | undefined)?.attributes,
    ALLOWED_RESOURCE_ATTRIBUTES,
  )

  // Stamped server-side so it cannot be spoofed by the client.
  attributes.push(stringAttribute('telemetry.source', 'mobile'))
  if (attribution.pseudoUserId) {
    attributes.push(stringAttribute('enduser.pseudo.id', attribution.pseudoUserId))
  }

  return { attributes }
}

function timestamp(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{1,20}$/.test(value) ? value : undefined
}

function sanitizeSpan(span: unknown): Record<string, unknown> | null {
  if (typeof span !== 'object' || span === null) return null
  const source = span as Record<string, unknown>
  if (typeof source.traceId !== 'string' || !/^[0-9a-f]{32}$/.test(source.traceId)
    || typeof source.spanId !== 'string' || !/^[0-9a-f]{16}$/.test(source.spanId)) return null

  const events = Array.isArray(source.events)
    ? source.events.filter((event) => typeof event === 'object' && event !== null).slice(0, MAX_EVENTS_PER_SPAN).map((event) => {
        const item = event as Record<string, unknown>
        return {
          name: typeof item.name === 'string' ? safeOperation(item.name) : 'event',
          timeUnixNano: timestamp(item.timeUnixNano),
          attributes: sanitizeAttributes(item.attributes, ALLOWED_SIGNAL_ATTRIBUTES),
        }
      })
    : undefined

  return {
    traceId: source.traceId,
    spanId: source.spanId,
    parentSpanId: typeof source.parentSpanId === 'string' && /^[0-9a-f]{16}$/.test(source.parentSpanId) ? source.parentSpanId : undefined,
    name: typeof source.name === 'string' ? safeOperation(source.name) : 'span',
    kind: typeof source.kind === 'number' ? source.kind : 1,
    startTimeUnixNano: timestamp(source.startTimeUnixNano),
    endTimeUnixNano: timestamp(source.endTimeUnixNano),
    attributes: sanitizeAttributes(source.attributes, ALLOWED_SIGNAL_ATTRIBUTES),
    status: typeof source.status === 'object' && source.status !== null
      ? { code: [0, 1, 2].includes((source.status as { code: number }).code) ? (source.status as { code: number }).code : 0 }
      : undefined,
    events,
  }
}

function sanitizeLogRecord(record: unknown): Record<string, unknown> | null {
  if (typeof record !== 'object' || record === null) return null
  const source = record as Record<string, unknown>

  // Only a string body survives. A structured body is an arbitrary object
  // graph from an untrusted client — exactly the shape a request payload
  // would arrive in.
  const body = (source.body as { stringValue?: unknown } | undefined)?.stringValue
  const message = typeof body === 'string' && ['operation failed', 'invalid response'].includes(body)
    ? body.slice(0, MAX_BODY_LENGTH) : 'client event'

  return {
    timeUnixNano: timestamp(source.timeUnixNano),
    observedTimeUnixNano: timestamp(source.observedTimeUnixNano),
    severityNumber: typeof source.severityNumber === 'number' ? source.severityNumber : 9,
    severityText:
      typeof source.severityText === 'string' && ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].includes(source.severityText) ? source.severityText : undefined,
    body: { stringValue: message },
    attributes: sanitizeAttributes(source.attributes, ALLOWED_SIGNAL_ATTRIBUTES),
    // Keep only valid W3C ids for correlation; arbitrary client text is discarded.
    traceId: typeof source.traceId === 'string' && /^[0-9a-f]{32}$/.test(source.traceId) ? source.traceId : undefined,
    spanId: typeof source.spanId === 'string' && /^[0-9a-f]{16}$/.test(source.spanId) ? source.spanId : undefined,
  }
}

/**
 * Returns `null` when there is nothing worth forwarding, so the caller can
 * answer 202 without opening a connection to the collector.
 */
export function sanitizeOtlpPayload(
  signal: RelayedTelemetrySignal,
  payload: unknown,
  attribution: TelemetryAttribution,
): Record<string, unknown> | null {
  if (typeof payload !== 'object' || payload === null) return null

  const isTraces = signal === 'traces'
  const resourceKey = isTraces ? 'resourceSpans' : 'resourceLogs'
  const scopeKey = isTraces ? 'scopeSpans' : 'scopeLogs'
  const itemKey = isTraces ? 'spans' : 'logRecords'

  const resources = (payload as Record<string, unknown>)[resourceKey]
  if (!Array.isArray(resources)) return null

  const sanitizedResources = []
  for (const resource of resources.slice(0, MAX_RESOURCES)) {
    if (typeof resource !== 'object' || resource === null) continue
    const source = resource as Record<string, unknown>
    const scopes = Array.isArray(source[scopeKey]) ? (source[scopeKey] as unknown[]) : []

    const sanitizedScopes = []
    for (const scope of scopes.slice(0, MAX_SCOPES)) {
      if (typeof scope !== 'object' || scope === null) continue
      const scopeSource = scope as Record<string, unknown>
      const items = Array.isArray(scopeSource[itemKey]) ? (scopeSource[itemKey] as unknown[]) : []

      const sanitizedItems = items
        .slice(0, MAX_ITEMS_PER_SCOPE)
        .map((item) => (isTraces ? sanitizeSpan(item) : sanitizeLogRecord(item)))
        .filter((item): item is Record<string, unknown> => item !== null)

      if (sanitizedItems.length > 0) {
        sanitizedScopes.push({ scope: { name: 'garde-manger-mobile' }, [itemKey]: sanitizedItems })
      }
    }

    if (sanitizedScopes.length > 0) {
      sanitizedResources.push({
        resource: sanitizeResource(source.resource, attribution),
        [scopeKey]: sanitizedScopes,
      })
    }
  }

  if (sanitizedResources.length === 0) return null
  return { [resourceKey]: sanitizedResources }
}
