import db from '@adonisjs/lucid/services/db'
import type { AiQuotaPort, AiQuotaUsage } from '#domain/settings/interfaces/ai-quota-port.interface'

function periodOf(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function nextMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

export class LucidAiQuotaAdapter implements AiQuotaPort {
  async usage(householdId: string, limit: number | null, now: Date): Promise<AiQuotaUsage> {
    if (limit === null) return { used: 0, limit: null, resetsAt: null }

    const row = await db
      .from('ai_usage')
      .where('household_id', householdId)
      .where('period', periodOf(now))
      .first()

    return { used: row?.count ?? 0, limit, resetsAt: nextMonthStart(now) }
  }

  async record(householdId: string, now: Date): Promise<void> {
    // ponytail: check-then-increment is not atomic across concurrent
    // requests — two scans landing on the same tick can both pass the quota
    // check and push `count` one past `limit`. Acceptable at 2€/mois volumes;
    // switch to `UPDATE … WHERE count < limit RETURNING` if abuse shows up.
    await db.rawQuery(
      `insert into ai_usage (household_id, period, count)
       values (?, ?, 1)
       on conflict (household_id, period)
       do update set count = ai_usage.count + 1`,
      [householdId, periodOf(now)],
    )
  }
}
