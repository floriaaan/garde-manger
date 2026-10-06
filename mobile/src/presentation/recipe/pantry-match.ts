import { t } from '../../i18n/index.js'
/**
 * Does this recipe use what the foyer already has, and does it save anything?
 *
 * The backend deliberately refuses to answer that. `recipe-draft-parser.ts`
 * sets every generated ingredient's `productId` to `null` rather than guess a
 * name match, because that field is a real foreign key and a wrong guess would
 * be written to the database. Right call for the column — and it leaves the
 * one question the Recettes tab exists to answer ("qu'est-ce que je cuisine ce
 * soir avec ce qu'il me reste") unanswered on every AI recipe, which is all of
 * them.
 *
 * So the rapprochement lives here instead, in the presentation layer, where it
 * is allowed to be an estimate: normalized token overlap between an ingredient
 * label and a product name. Nothing here is persisted, nothing is sent to the
 * backend, and the screen says out loud that the availability it shows is
 * estimated. A `productId` that *does* exist (a recipe saved against real
 * products) is a fact and is used first — `estimated` reports whether any
 * guess was involved at all.
 */
import { daysUntilExpiry, matchesExpiryWindow, sortByExpiry } from '../dashboard/product-status.js'
import type { Product } from '../../domain/fridge/product.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

/**
 * Words that appear in half the fridge and match nothing useful. "frais" in
 * "épinards frais" must not make a recipe match "saumon frais".
 */
const STOPWORDS = new Set([
  'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'au', 'aux', 'et', 'en', 'pour', 'sur', 'sans', 'avec',
  'frai', 'fraiche', 'bio', 'nature', 'entier', 'entiere', 'demi', 'maison', 'gros', 'grosse', 'petit', 'petite',
  'grand', 'grande', 'jeune', 'cuit', 'cru', 'surgele', 'surgelee', 'nouveau', 'nouvelle',
])

/** Accents folded, punctuation dropped: "Épinards frais" and "epinard" are the same word here. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * French plurals only, and only past four letters: "épinards" and "épinard"
 * must collapse, "riz", "pois" and "ananas" must not lose their last letter.
 */
function singular(word: string): string {
  if (word.length <= 4) return word
  return word.endsWith('s') || word.endsWith('x') ? word.slice(0, -1) : word
}

/** Three letters is the floor because "riz", "thé" and "œuf" are all real answers. */
function tokens(value: string): string[] {
  return fold(value)
    .split(' ')
    .map(singular)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
}

export interface PantryMatch {
  /** Ingredients the foyer probably already owns. */
  owned: number
  total: number
  /**
   * Which ingredient resolved to which product, keyed by ingredient id.
   *
   * The detail screen used to split its own ingredient list on
   * `productId !== null` — a field `recipe-draft-parser.ts` sets to `null` on
   * every AI-generated ingredient, which is all of them. So the list promised
   * "2 sur 3 chez toi", the detail screen showed all three under "À prévoir",
   * and the app offered to buy the spinach it had just said you owned. One
   * join, read by both screens.
   */
  byIngredient: Map<string, Product>
  /** The products this recipe probably uses, soonest expiry first. */
  products: Product[]
  /**
   * The product this recipe saves: the soonest-expiring match still inside the
   * week. A date already past is never a rescue — the app tells a foyer what to
   * cook, not what to risk.
   */
  rescue: Product | null
  /** True when any match came from the name heuristic rather than a stored `productId`. */
  estimated: boolean
}

export function matchPantry(recipe: Recipe, products: readonly Product[], now?: Date): PantryMatch {
  const byId = new Map(products.map((product) => [product.id, product]))
  const indexed = products.map((product) => ({ product, tokens: new Set(tokens(product.name)) }))
  const matched = new Map<string, Product>()
  const byIngredient = new Map<string, Product>()
  let estimated = false

  for (const ingredient of recipe.ingredients) {
    const linked = ingredient.productId ? byId.get(ingredient.productId) : undefined
    if (linked) {
      byIngredient.set(ingredient.id, linked)
      matched.set(linked.id, linked)
      continue
    }
    const words = tokens(ingredient.label)
    const hit = indexed.find((entry) => words.some((word) => entry.tokens.has(word)))
    if (!hit) continue
    estimated = true
    byIngredient.set(ingredient.id, hit.product)
    matched.set(hit.product.id, hit.product)
  }

  const products_ = sortByExpiry([...matched.values()], now)
  const rescue = products_.find((product) => matchesExpiryWindow(daysUntilExpiry(product, now), 'week')) ?? null
  return {
    owned: byIngredient.size,
    total: recipe.ingredients.length,
    byIngredient,
    products: products_,
    rescue,
    estimated,
  }
}

/**
 * The ingredient list split the way the screen shows it. Same join as the
 * count on the list card, so the two can never disagree.
 */
export function splitIngredients(recipe: Recipe, match: PantryMatch) {
  return {
    owned: recipe.ingredients.filter((ingredient) => match.byIngredient.has(ingredient.id)),
    missing: recipe.ingredients.filter((ingredient) => !match.byIngredient.has(ingredient.id)),
  }
}

/**
 * How much of a recipe the foyer has, in words — one spelling, everywhere.
 *
 * The hero said "2 ingrédients sur 3 chez toi", the alternate beside it "2/3
 * chez toi" and the row below "2 sur 3 chez toi": three renderings of one fact
 * on one screen, which reads as three different facts. `short` is for a chip
 * that has ~140pt; the full sentence is for anything with a line to itself.
 */
export function pantrySentence(match: PantryMatch, { short = false }: { short?: boolean } = {}): string {
  if (short) return t('recipe.of_at_home', { value1: match.owned, value2: match.total })
  if (match.owned === 0) return t('recipe.none_of_the_ingredients_at_home', { value1: match.total })
  return t('recipe.of_ingredients_at_home', { count: match.owned, value2: match.total })
}

export function coverage(match: PantryMatch): number {
  return match.total === 0 ? 0 : match.owned / match.total
}

export interface TonightCandidate {
  recipe: Recipe
  match: PantryMatch
  rescue: Product
  /** Days left on the rescued product — 0 is tonight, and the sort's first key. */
  rescueDays: number
}

/**
 * The evening's shortlist: the recipes that save something, most urgent first.
 *
 * Deliberately empty rather than padded when nothing in the fridge is due this
 * week. "Ce soir" is a claim about the garde-manger, so a section that always
 * fills itself would be recommending a dish for a reason it invented.
 */
export function pickTonight(
  recipes: readonly Recipe[],
  products: readonly Product[],
  { now, limit = 3 }: { now?: Date; limit?: number } = {},
): TonightCandidate[] {
  return recipes
    .filter((recipe) => !recipe.isArchived)
    .flatMap((recipe) => {
      const match = matchPantry(recipe, products, now)
      if (!match.rescue) return []
      const rescueDays = daysUntilExpiry(match.rescue, now)
      if (rescueDays === null) return []
      return [{ recipe, match, rescue: match.rescue, rescueDays }]
    })
    .sort((a, b) => {
      if (a.rescueDays !== b.rescueDays) return a.rescueDays - b.rescueDays
      const byCoverage = coverage(b.match) - coverage(a.match)
      if (byCoverage !== 0) return byCoverage
      return b.recipe.createdAt.localeCompare(a.recipe.createdAt)
    })
    .slice(0, limit)
}
