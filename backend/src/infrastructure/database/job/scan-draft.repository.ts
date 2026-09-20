import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ScanDraftRepository } from '#domain/job/interfaces/scan-draft-repository.interface'
import type { ScanDraft, ScanDraftKind, ScanDraftStatus } from '#domain/job/scan-draft'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'

interface ScanDraftRow {
  id: string
  household_id: string
  job_id: string
  kind: ScanDraftKind
  payload: unknown
  image_keys: string[]
  status: ScanDraftStatus
  expires_at: Date
  created_at: Date
}

function toDomain(row: ScanDraftRow): ScanDraft {
  // JSON has no Date: the receipt's own purchase date comes back as a string.
  const payload =
    row.kind === 'receipt'
      ? {
          ...(row.payload as ReceiptDraft),
          scannedAt: new Date((row.payload as ReceiptDraft).scannedAt),
        }
      : (row.payload as FridgeScanDraft)
  return {
    id: row.id,
    householdId: row.household_id,
    jobId: row.job_id,
    kind: row.kind,
    payload,
    imageKeys: row.image_keys,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export async function insertOrReplaceDraft(
  draft: ScanDraft,
  trx?: TransactionClientContract,
): Promise<void> {
  await (trx ?? db).rawQuery(
    `insert into scan_draft (id, household_id, job_id, kind, payload, image_keys, status, expires_at, created_at)
     values (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)
     on conflict (id) do update set
       payload = excluded.payload, image_keys = excluded.image_keys,
       status = excluded.status, expires_at = excluded.expires_at`,
    [
      draft.id,
      draft.householdId,
      draft.jobId,
      draft.kind,
      JSON.stringify(draft.payload),
      JSON.stringify(draft.imageKeys),
      draft.status,
      draft.expiresAt,
      draft.createdAt,
    ],
  )
}

export class LucidScanDraftRepository implements ScanDraftRepository {
  async findById(id: string): Promise<ScanDraft | null> {
    const row = await db.from('scan_draft').where('id', id).first()
    return row ? toDomain(row as ScanDraftRow) : null
  }

  async findByJobId(jobId: string): Promise<ScanDraft | null> {
    const row = await db.from('scan_draft').where('job_id', jobId).first()
    return row ? toDomain(row as ScanDraftRow) : null
  }

  async listPending(householdId: string): Promise<ScanDraft[]> {
    const rows = await db
      .from('scan_draft')
      .where('household_id', householdId)
      .where('status', 'pending')
      .orderBy('created_at', 'desc')
    return rows.map((row) => toDomain(row as ScanDraftRow))
  }

  async save(draft: ScanDraft): Promise<void> {
    await insertOrReplaceDraft(draft)
  }

  async listPurgeable(now: Date): Promise<ScanDraft[]> {
    const rows = await db
      .from('scan_draft')
      .where((q) => q.where('expires_at', '<', now).orWhere('status', 'discarded'))
    return rows.map((row) => toDomain(row as ScanDraftRow))
  }

  async delete(id: string): Promise<void> {
    await db.from('scan_draft').where('id', id).delete()
  }
}
