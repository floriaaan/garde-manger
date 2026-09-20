/**
 * Thrown when a household on the hosted instance has used up its monthly AI
 * quota (free or subscriber tier alike).
 *
 * Carries `status`/`code` like the 401 `requireAuthenticatedUser` throws:
 * the resolution happens inside the provider registry, before any use-case
 * exists to turn it into a `Result.err(...)`, so it travels to the client
 * through `exception-handler.ts` — which renders exactly the `{ error:
 * { type, message } }` shape `error-serializer.ts` produces, and which
 * `trace-action.ts` logs as a routine 4xx rather than a crash.
 */
export class AiQuotaExceededError extends Error {
  readonly status = 402
  readonly code = 'ai_quota_exceeded'

  constructor(public readonly limit: number) {
    super(`Quota IA mensuel atteint (${limit}).`)
  }
}
