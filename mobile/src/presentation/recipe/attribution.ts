import { t } from '../../i18n/index.js'
import type { Household } from '../../domain/identity/household.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

/**
 * Who a recipe belongs to, in the foyer's own words.
 *
 * The library is the most shared artefact this product has — four people
 * generate into one list — and it rendered no trace of who put a row there or
 * whether anyone had ever cooked it. Sorting by an invisible timestamp was the
 * only order it could offer.
 *
 * Ids resolve against the household's own member list, so a member who has
 * left resolves to `null` rather than to a name the foyer no longer knows.
 */
export function memberName(userId: string | null, household: Household | null | undefined): string | null {
  if (!userId || !household) return null
  return household.members.find((member) => member.userId === userId)?.name ?? null
}

/** `true` when the signed-in user is the one named — "toi" reads better than your own name. */
export function isSelf(userId: string | null, selfId: string | null | undefined): boolean {
  return userId !== null && userId === selfId
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "aujourd'hui" / "hier" / "il y a 4 j" — the register the rest of the app uses for dates. */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
  if (days <= 0) return t('recipe.today')
  if (days === 1) return t('job.yesterday')
  if (days < 30) return t('job.days_ago', { value1: days })
  return t('recipe.a_long_time_ago')
}

/**
 * The one line a library row spends on provenance, or `null` when there is
 * nothing true to say. Cooked beats authored: what the foyer *did* with a
 * recipe is a stronger reason to pick it again than who typed it in.
 */
export function provenanceLine(
  recipe: Recipe,
  household: Household | null | undefined,
  selfId: string | null | undefined,
  now?: Date,
): string | null {
  if (recipe.cookCount > 0 && recipe.lastCookedAt) {
    const who = isSelf(recipe.lastCookedBy, selfId) ? t('recipe.you') : memberName(recipe.lastCookedBy, household)
    const times = recipe.cookCount === 1 ? t('recipe.cooked_once') : t('recipe.cooked_times', { value1: recipe.cookCount })
    const when = agoLabel(recipe.lastCookedAt, now)
    return who ? `${times} · ${who}, ${when}` : `${times} · ${when}`
  }
  const author = isSelf(recipe.createdBy, selfId) ? t('recipe.you') : memberName(recipe.createdBy, household)
  return author ? t('recipe.added_by', { value1: author }) : null
}
