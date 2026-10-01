/*
|--------------------------------------------------------------------------
| OpenTelemetry bootstrap
|--------------------------------------------------------------------------
|
| Loaded with `node --import ./instrumentation.ts` — *before* any application
| module. That ordering is not a style choice: the instrumentations patch
| `node:http`, `pg` and `pino` as they are first loaded, and a module already
| resolved into an ESM namespace can no longer be patched.
|
| `.ts`, run directly by Node's built-in type-stripping (stable since Node
| 24, which `engines` already requires) — no build step, no `ts-node`, no
| separate loader to register before this one runs. It is declared in
| `adonisrc.ts` `metaFiles` so `node ace build` copies it next to
| `bin/server.js` as-is.
|
| Everything here is a no-op unless `OTEL_ENABLED=true`, and every failure is
| swallowed: a broken collector, a wrong endpoint or a missing package must
| never stop the API from booting.
|
*/

// AdonisJS reads `.env` during boot, which is far too late for this file.
// In Docker the variables come from the environment and there is no `.env`.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env file — expected in a container.
}

const { hostname } = await import('node:os')

const enabled = process.env.OTEL_ENABLED === 'true'

if (enabled) {
  try {
    /**
     * `@opentelemetry/api`'s diag logger is a no-op until something sets
     * one — every runtime export failure (a bad endpoint, a network error,
     * a batch that never flushes) is then swallowed with zero output, on
     * both the app's console and everywhere else. `warn` only: `info`
     * would print one line per successful export.
     */
    const { diag, DiagConsoleLogger, DiagLogLevel } = await import('@opentelemetry/api')
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN)

    /**
     * Required, not optional. The instrumentations patch a module as it is
     * loaded, which works out of the box for CommonJS (`pg`, `pino`) but not
     * for ESM: `import http from 'node:http'` resolves through a namespace
     * that ignores later mutation of the module object. This registers
     * OpenTelemetry's ESM loader hook so those imports are intercepted at
     * resolution time.
     *
     * Measured, not assumed: without it the SDK starts, the exporter works,
     * manual spans and outgoing `fetch` spans (undici, CommonJS) all arrive —
     * and not one SERVER span is ever produced, because AdonisJS imports
     * `node:http` as ESM.
     */
    const { register } = await import('node:module')
    /**
     * `include` — without it this hook wraps *every* ESM module in the
     * process, AdonisJS's own included: `#start/routes` and every
     * `providers/*.ts` file loaded through it. import-in-the-middle fails
     * to wrap several of them ("failed to wrap .../providers/..."), and the
     * router that `#start/routes` populates ends up a different instance
     * from the one the HTTP kernel serves — every route, `/health`
     * included, 404s. Confirmed by toggling `OTEL_ENABLED`: false serves
     * normally, true 404s on every route, both on a cold process.
     *
     * `node:http` is needed for the same reason as the comment above says:
     * AdonisJS imports it as ESM, so HttpInstrumentation only sees it
     * through this hook. `pino` needs it too, for a different reason: it's
     * plain CommonJS, but `@adonisjs/logger` (itself ESM, `"type":
     * "module"`) does `import { pino } from 'pino'` — a *named* ESM import
     * off a CJS package, which Node resolves through its own cjs-module-
     * lexer static analysis before any code runs, same as `node:http`
     * above. Without `pino` in this list, `PinoInstrumentation` never sees
     * the factory AdonisJS actually calls — trace/log correlation and the
     * mirrored OTLP logs pipeline both go silently empty, not by an error.
     */
    register('@opentelemetry/instrumentation/hook.mjs', import.meta.url, {
      data: { include: ['node:http', 'pino'] },
    })

    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const { resourceFromAttributes } = await import('@opentelemetry/resources')
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics')
    const { BatchLogRecordProcessor } = await import('@opentelemetry/sdk-logs')
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto')
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-proto')
    const { OTLPLogExporter } = await import('@opentelemetry/exporter-logs-otlp-proto')
    const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http')
    const { UndiciInstrumentation } = await import('@opentelemetry/instrumentation-undici')
    const { PgInstrumentation } = await import('@opentelemetry/instrumentation-pg')
    const { PinoInstrumentation } = await import('@opentelemetry/instrumentation-pino')
    const { RuntimeNodeInstrumentation } =
      await import('@opentelemetry/instrumentation-runtime-node')

    const resource = resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME || 'garde-manger-backend',
      'service.version': process.env.APP_VERSION || '0.0.0',
      'service.build': process.env.APP_BUILD || process.env.APP_VERSION || '0.0.0',
      'os.name': 'node',
      'deployment.environment.name':
        process.env.DEPLOY_ENV || process.env.NODE_ENV || 'development',
      // Container hostname — enough to tell two instances apart, and nothing
      // more.
      'service.instance.id': hostname(),
    })

    const sdk = new NodeSDK({
      resource,
      /**
       * The default detectors attach `host.id`, `process.executable.path` and
       * `process.command_args` — the machine's identity and the full command
       * line — to every single record. The command line is the one that
       * matters: a flag holding a secret would end up in the telemetry store,
       * on every span, forever. The four attributes above are the ones worth
       * having.
       */
      autoDetectResources: false,
      traceExporter: new OTLPTraceExporter(),
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
          exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL || 60_000),
        }),
      ],
      // `{ exporter }`, not a positional argument: the options-object form is
      // what this version takes, and passing the exporter positionally leaves
      // the processor with no exporter at all — logs are then dropped
      // silently, with only a diag warning to show for it.
      logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
      instrumentations: [
        new HttpInstrumentation({
          // Docker polls /health every 30s per container; that is noise, not
          // signal. Dropped here rather than in the collector so it never
          // costs a span allocation.
          ignoreIncomingRequestHook: (request) => (request.url ?? '').startsWith('/health'),
          // Headers are NOT captured (`headersToSpanAttributes` left unset):
          // `authorization` and `cookie` would be the two most interesting
          // ones and both are credentials.
        }),
        // `fetch()` in Node is undici — the OpenFoodFacts lookup, Ollama and
        // the OpenAI/Gemini SDKs all go through it.
        new UndiciInstrumentation(),
        // Lucid (knex) and better-auth (kysely) both sit on `pg`.
        // `enhancedDatabaseReporting` stays off: it would attach bound query
        // parameters — i.e. user data — to every span.
        new PgInstrumentation({ enhancedDatabaseReporting: false }),
        // Injects trace_id/span_id into every AdonisJS log line and mirrors
        // the line to the OTLP logs pipeline. stdout logging is untouched,
        // so `docker logs` keeps working when the collector is down.
        new PinoInstrumentation(),
        // Event-loop lag, GC pauses, heap — the metrics that explain a slow
        // request when the traces alone do not.
        new RuntimeNodeInstrumentation(),
      ],
    })

    sdk.start()

    const shutdown = () => {
      sdk.shutdown().catch(() => {}) // Never block a SIGTERM on the exporter.
    }
    process.once('SIGTERM', shutdown)
    process.once('SIGINT', shutdown)
  } catch (error) {
    // Deliberately console, not the app logger: it does not exist yet.
    const message = error instanceof Error ? error.message : error
    console.error('[otel] disabled — bootstrap failed:', message)
  }
}
