import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DB_PATH = process.env.WAITLIST_DB_PATH ?? './data/waitlist.sqlite3'

let db: DatabaseSync | null = null

/** Lazy singleton: the server function runs per-request but the file handle shouldn't be reopened each time. */
function getDb(): DatabaseSync {
  if (db) return db
  mkdirSync(dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist_email (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  return db
}

/** Idempotent: re-submitting the same email is a no-op, not an error — the caller learns which happened. */
export function insertWaitlistEmail(email: string): { alreadySubscribed: boolean } {
  const result = getDb()
    .prepare('INSERT OR IGNORE INTO waitlist_email (email) VALUES (?)')
    .run(email.trim().toLowerCase())
  return { alreadySubscribed: result.changes === 0 }
}
