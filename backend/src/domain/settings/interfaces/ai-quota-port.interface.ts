export interface AiQuotaUsage {
  used: number
  /** `null` = uncapped (self-hosted). */
  limit: number | null
  /** `null` when uncapped. */
  resetsAt: Date | null
}

/**
 * Per-household, per-calendar-month counter of successful AI calls (receipt
 * scan, fridge scan, recipe generation each count as one). Self-hosted
 * instances never consult this — `AiAccess.plan === 'self-hosted'` short-
 * circuits the check in `ai-provider-registry.ts` before it would.
 */
export interface AiQuotaPort {
  usage(householdId: string, limit: number | null, now: Date): Promise<AiQuotaUsage>
  /** Increments this month's counter by one — call only after a successful call. */
  record(householdId: string, now: Date): Promise<void>
}
