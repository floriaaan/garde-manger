import { t } from '../../i18n/index.js'
/**
 * The Recettes composer's one piece of logic: turn what the cook picked into
 * the single free-text `prompt` that `POST /api/recipes/generate` accepts.
 *
 * The endpoint takes a string and nothing else — there is no structured
 * constraint field to fill — so the chips are a vocabulary for writing that
 * string, not a second API. Keeping the composition here (pure, no React)
 * means the wording the model actually receives is readable and testable in
 * one place instead of being assembled inside a press handler.
 *
 * Every group is optional, including all of them at once: an untouched form
 * generates exactly as the button did before the composer existed.
 */

export interface RecipeOption {
  id: string
  label: string
  /** The clause this option contributes to the sentence, in the current app language. */
  clause: string
}

export interface RecipeOptionGroup {
  id: string
  label: string
  /** Key into `GROUP_ICONS` — one glyph per group, because six groups ask six different questions. */
  icon: 'repas' | 'temps' | 'regime' | 'cuisine' | 'enCuisine' | 'portions'
  /** `single` groups behave like a radio that can be un-picked; `multi` groups stack. */
  mode: 'single' | 'multi'
  options: readonly RecipeOption[]
}

export const RECIPE_OPTION_GROUPS: readonly RecipeOptionGroup[] = [
  {
    id: 'repas',
    icon: 'repas',
    get label() { return t('recipe.meal_type') },
    mode: 'single',
    options: [
      { id: 'petit-dejeuner', get label() { return t('recipe.breakfast') }, get clause() { return t('recipe.for_breakfast') } },
      { id: 'dejeuner', get label() { return t('recipe.lunch') }, get clause() { return t('recipe.for_lunch') } },
      { id: 'diner', get label() { return t('recipe.dinner') }, get clause() { return t('recipe.for_dinner') } },
      { id: 'apero', get label() { return t('recipe.aperitif') }, get clause() { return t('recipe.to_serve_as_an_aperitif') } },
      { id: 'dessert', get label() { return t('recipe.dessert') }, get clause() { return t('recipe.for_dessert') } },
    ],
  },
  {
    id: 'temps',
    icon: 'temps',
    get label() { return t('recipe.time_in_the_kitchen') },
    mode: 'single',
    options: [
      { id: 'express', get label() { return t('recipe.15_min') }, get clause() { return t('recipe.ready_in_under_15_minutes') } },
      { id: 'court', get label() { return t('recipe.30_min') }, get clause() { return t('recipe.ready_in_under_30_minutes') } },
      { id: 'mijote', get label() { return t('recipe.we_have_time') }, get clause() { return t('recipe.that_can_simmer_slowly') } },
    ],
  },
  {
    id: 'regime',
    icon: 'regime',
    get label() { return t('recipe.diet') },
    mode: 'multi',
    options: [
      { id: 'vegetarien', get label() { return t('recipe.vegetarian') }, get clause() { return t('recipe.vegetarian_2') } },
      { id: 'vegan', get label() { return t('recipe.vegan') }, get clause() { return t('recipe.vegan_2') } },
      { id: 'sans-gluten', get label() { return t('recipe.gluten_free') }, get clause() { return t('recipe.gluten_free_2') } },
      { id: 'sans-lactose', get label() { return t('recipe.lactose_free') }, get clause() { return t('recipe.lactose_free_2') } },
    ],
  },
  {
    id: 'cuisine',
    icon: 'cuisine',
    get label() { return t('recipe.world_flavours') },
    mode: 'single',
    options: [
      { id: 'italien', get label() { return t('recipe.italian') }, get clause() { return t('recipe.italian_inspired') } },
      { id: 'asiatique', get label() { return t('recipe.asian') }, get clause() { return t('recipe.asian_inspired') } },
      { id: 'oriental', get label() { return t('recipe.middle_eastern') }, get clause() { return t('recipe.middle_eastern_inspired') } },
      { id: 'terroir', get label() { return t('recipe.regional') }, get clause() { return t('recipe.traditional_french_cuisine') } },
    ],
  },
  {
    id: 'materiel',
    icon: 'enCuisine',
    get label() { return t('recipe.in_the_kitchen') },
    mode: 'multi',
    options: [
      { id: 'sans-four', get label() { return t('recipe.no_oven') }, get clause() { return t('recipe.without_an_oven') } },
      { id: 'un-plat', get label() { return t('recipe.one_dish') }, get clause() { return t('recipe.as_one_dish') } },
      { id: 'sans-robot', get label() { return t('recipe.no_food_processor') }, get clause() { return t('recipe.without_a_food_processor') } },
      { id: 'enfants', get label() { return t('recipe.for_children') }, get clause() { return t('recipe.that_children_will_eat') } },
    ],
  },
  {
    id: 'portions',
    icon: 'portions',
    get label() { return t('recipe.servings') },
    mode: 'single',
    options: [
      { id: '1', get label() { return t('recipe.for_1') }, get clause() { return t('recipe.for_1_person') } },
      { id: '2', get label() { return t('recipe.for_2') }, get clause() { return t('recipe.for_2_people') } },
      { id: '4', get label() { return t('recipe.for_4') }, get clause() { return t('recipe.for_4_people') } },
      { id: '6', get label() { return t('recipe.for_6') }, get clause() { return t('recipe.for_6_people') } },
    ],
  },
]

/** Selections keyed by group id — a `single` group holds at most one id. */
export type RecipeSelections = Readonly<Record<string, readonly string[]>>

export interface RecipeWish {
  /** What the cook typed, verbatim. Leads the sentence — it is the most specific thing said. */
  freeText: string
  /** Ingredients or flavours to keep out. Becomes a "sans …" clause at the end. */
  avoid: string
  selections: RecipeSelections
  /**
   * Products the cook pinned from their own garde-manger, by name. The one
   * control in this composer that no generic recipe app can offer: every other
   * group here (meal, time, diet, cuisine) ships in every competitor, and none
   * of them knows what is actually in your kitchen tonight.
   */
  pinned: readonly string[]
}

export const EMPTY_WISH: RecipeWish = { freeText: '', avoid: '', selections: {}, pinned: [] }

export function isPinned(wish: RecipeWish, name: string): boolean {
  return wish.pinned.includes(name)
}

export function togglePinned(wish: RecipeWish, name: string): RecipeWish {
  return {
    ...wish,
    pinned: wish.pinned.includes(name) ? wish.pinned.filter((pin) => pin !== name) : [...wish.pinned, name],
  }
}

export function isSelected(wish: RecipeWish, groupId: string, optionId: string): boolean {
  return (wish.selections[groupId] ?? []).includes(optionId)
}

/** Toggling respects the group's own mode: `single` swaps, `multi` accumulates, both un-pick. */
export function toggleOption(wish: RecipeWish, group: RecipeOptionGroup, optionId: string): RecipeWish {
  const current = wish.selections[group.id] ?? []
  const next = current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : group.mode === 'single'
      ? [optionId]
      : [...current, optionId]
  return { ...wish, selections: { ...wish.selections, [group.id]: next } }
}

export function countSelections(wish: RecipeWish): number {
  return Object.values(wish.selections).reduce((total, ids) => total + ids.length, 0)
}

export function isWishEmpty(wish: RecipeWish): boolean {
  return (
    wish.freeText.trim().length === 0 &&
    wish.avoid.trim().length === 0 &&
    wish.pinned.length === 0 &&
    countSelections(wish) === 0
  )
}

function clausesOf(wish: RecipeWish): string[] {
  const clauses: string[] = []
  // First, because it is the most concrete thing the cook can ask for and the
  // only clause drawn from their own shelves.
  if (wish.pinned.length > 0) clauses.push(t('recipe.using_2', { value1: joinFr(wish.pinned) }))
  for (const group of RECIPE_OPTION_GROUPS) {
    for (const option of group.options) {
      if (isSelected(wish, group.id, option.id)) clauses.push(option.clause)
    }
  }
  const avoid = wish.avoid.trim()
  if (avoid) clauses.push(t('recipe.without', { value1: avoid }))
  return clauses
}

/**
 * `undefined` when nothing was asked for — the app then generates exactly as
 * it did before the composer existed, which is the common case and must stay
 * one tap away.
 */
export function composeRecipePrompt(wish: RecipeWish): string | undefined {
  const typed = wish.freeText.trim()
  const clauses = clausesOf(wish)

  if (!typed && clauses.length === 0) return undefined
  if (!typed) return t('recipe.a_recipe', { value1: clauses.join(', ') })
  if (clauses.length === 0) return typed
  return `${typed} — ${clauses.join(', ')}.`
}

/** Joins names using the current language’s conjunction. */
export function joinFr(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return t('recipe.and', { value1: names.slice(0, -1).join(', '), value2: names[names.length - 1] })
}

/** A one-line recap of everything the wish is holding. */
export function describeWish(wish: RecipeWish): string | null {
  const parts: string[] = []
  const typed = wish.freeText.trim()
  if (typed) parts.push(typed)
  if (wish.pinned.length > 0) parts.push(joinFr(wish.pinned))
  for (const group of RECIPE_OPTION_GROUPS) {
    for (const option of group.options) {
      if (isSelected(wish, group.id, option.id)) parts.push(option.label)
    }
  }
  const avoid = wish.avoid.trim()
  if (avoid) parts.push(t('recipe.without', { value1: avoid }))
  return parts.length > 0 ? parts.join(' · ') : null
}
