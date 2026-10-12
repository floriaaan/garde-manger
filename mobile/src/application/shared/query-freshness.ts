import type { QueryKey } from '@tanstack/react-query'

const SECOND = 1000
const MINUTE = 60 * SECOND

/** Freshness is separate from retention. See docs/cache-freshness.md. */
export const QUERY_STALE_TIMES: Readonly<Record<string, number>> = {
  household: MINUTE,
  products: 30 * SECOND,
  product: 30 * SECOND,
  'shopping-items': 30 * SECOND,
  jobs: 2 * SECOND,
  'scan-drafts': 30 * SECOND,
  'scan-draft': 30 * SECOND,
  recipes: 5 * MINUTE,
  recipe: 5 * MINUTE,
  receipts: 5 * MINUTE,
  receipt: 5 * MINUTE,
  'product-outcome-stats': 5 * MINUTE,
  'reminder-settings': 5 * MINUTE,
  'ai-settings': MINUTE,
  'ha-link': MINUTE,
  'instance-info': 5 * MINUTE,
  'product-lookup': 24 * 60 * MINUTE,
}

export function queryStaleTime(queryKey: QueryKey): number {
  const domain = queryKey[0]
  return typeof domain === 'string' ? QUERY_STALE_TIMES[domain] ?? 0 : 0
}
