import { t } from '../../i18n/index.js'
/**
 * Expiry semantics for the whole app, derived from a real `Product`.
 *
 * Replaces the helpers that used to live in `dashboard.fixture.ts` next to
 * synthetic rows: the thresholds (expired at day 0, "soon" up to 3 days) are
 * product rules, not fixture details, and the fridge/detail/dashboard screens
 * all have to agree on them or the same yoghurt reads "En premier" on one
 * screen and "Dépassé" on the next.
 */
import type { Product } from '../../domain/fridge/product.js'

export type ProductStatus = 'fresh' | 'soon' | 'expired'

const DAY_MS = 24 * 60 * 60 * 1000

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Both sides of the subtraction are reduced to a calendar day before it, so
 * "expires tonight at 23:00" is 0 days away rather than 0.4.
 *
 * `expiresAt` is **a calendar date the user picked, encoded as midnight UTC**
 * — `new Date('2026-09-06').toISOString()` is what every write in the app
 * produces (`fridge-form-screen.tsx`, the receipt import, the fixtures). So
 * its Y-M-D is read straight off the string rather than through the device's
 * timezone: local getters would turn that same value into 5 September for
 * every user west of Greenwich, all day long.
 *
 * `today`, by contrast, is the day the person is standing in, which is local.
 * The two agree because both name the user's intended calendar day. They only
 * disagree for a value that is a genuine *instant* rather than a date, which
 * nothing in this app writes — a test helper that builds one with
 * `new Date(Date.now()).toISOString()` is reproducing a shape production never
 * sees, and will read one day short between local midnight and UTC midnight.
 */
function expiryDay(expiresAt: string): number | null {
  const match = ISO_DATE.exec(expiresAt)
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const parsed = new Date(expiresAt)
  if (Number.isNaN(parsed.getTime())) return null
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

/** `null` when the product carries no expiry date at all (rice, spices...). */
export function daysUntilExpiry(product: Pick<Product, 'expiresAt'>, now: Date = new Date()): number | null {
  if (!product.expiresAt) return null
  const expires = expiryDay(product.expiresAt)
  if (expires === null) return null
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((expires - today) / DAY_MS)
}

/**
 * A product expiring *today* is a warning, not a loss — it is exactly the
 * thing the app exists to get you to cook tonight. Only a date already past
 * reads as expired. (The fridge list and the dashboard used to disagree on
 * this, so the same yoghurt read "En premier" on one screen and "Dépassé" on
 * the next.)
 */
export function statusOf(daysLeft: number | null): ProductStatus {
  if (daysLeft === null) return 'fresh'
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 3) return 'soon'
  return 'fresh'
}

export function productStatus(product: Pick<Product, 'expiresAt'>, now?: Date): ProductStatus {
  return statusOf(daysUntilExpiry(product, now))
}

export function expiryLabel(daysLeft: number | null): string {
  if (daysLeft === null) return t('dashboard.no_date')
  if (daysLeft < 0) return t('dashboard.days_past_expiry', { value1: Math.abs(daysLeft) })
  if (daysLeft === 0) return t('dashboard.use_today')
  if (daysLeft === 1) return t('dashboard.use_tomorrow')
  if (daysLeft <= 30) return t('dashboard.use_within_days', { value1: daysLeft })
  return t('dashboard.long_shelf_life')
}

/**
 * Soonest first, undated products last — the order every "what do I use up
 * next" surface wants, and the one the fridge list used to lack entirely.
 */
export function sortByExpiry<T extends Pick<Product, 'expiresAt'>>(products: readonly T[], now?: Date): T[] {
  return [...products].sort((a, b) => {
    const left = daysUntilExpiry(a, now)
    const right = daysUntilExpiry(b, now)
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    return left - right
  })
}

/**
 * The two answers the dashboard's stat cards give, and the two filters the
 * garde-manger can be opened onto. They live here, next to `statusOf`, for the
 * reason this file exists at all: the dashboard used to count "cette semaine"
 * with its own inline predicate, so a card and the list it now links to would
 * have drifted the first time either threshold moved.
 *
 * `week` includes day 0 on purpose. The dashboard's old count was
 * `daysLeft > 0 && daysLeft <= 7`, which left a product expiring *today* in
 * neither card — invisible in the one place the app exists to make it visible.
 * A gap is survivable in a number and not in a link.
 *
 * Neither window covers undated products (rice, spices): "cette semaine" is a
 * claim about a date, and a product without one makes no claim.
 */
export type ExpiryWindow = 'week' | 'expired'

export const EXPIRY_WINDOWS: readonly ExpiryWindow[] = ['week', 'expired']

/** The one wording, shared by the stat card that links and the pill that says why the list is short. */
export const EXPIRY_WINDOW_LABELS: Record<ExpiryWindow, string> = {
  get week() { return t('dashboard.this_week_2') },
  get expired() { return t('dashboard.past_expiry_dates') },
}

export function matchesExpiryWindow(daysLeft: number | null, window: ExpiryWindow): boolean {
  if (daysLeft === null) return false
  return window === 'expired' ? daysLeft < 0 : daysLeft >= 0 && daysLeft <= 7
}

/** A window arriving as a URL parameter is a string from outside — anything else filters nothing. */
export function parseExpiryWindow(value: string | string[] | undefined): ExpiryWindow | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return EXPIRY_WINDOWS.find((window) => window === candidate) ?? null
}
