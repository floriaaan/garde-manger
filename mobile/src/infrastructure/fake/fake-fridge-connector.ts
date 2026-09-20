import { Result } from '../../domain/shared/result.js'
import { fakeSession } from './fixtures/session.fixture.js'
import { fakeHousehold } from './fixtures/household.fixture.js'
import { normalizeInviteCode } from '../../domain/identity/invite-code.js'
import { fakeShoppingItems } from './fixtures/shopping-item.fixture.js'
import { fakeRecipes } from './fixtures/recipe.fixture.js'
import { fakeProducts } from './fixtures/product.fixture.js'
import { fakeProductOutcomes } from './fixtures/product-outcome.fixture.js'
import { fakeProductLookup } from './fixtures/product-lookup.fixture.js'
import { fakeReceiptDraft } from './fixtures/receipt-draft.fixture.js'
import { fakeFridgeScanDraft } from './fixtures/fridge-scan-draft.fixture.js'
import { fakeReceipts } from './fixtures/receipt.fixture.js'
import { fakeAiSettings } from './fixtures/ai-settings.fixture.js'
import { fakeUnconfiguredHaLink } from './fixtures/ha-link.fixture.js'
import { mergeQuantities, normalizeShoppingItemName } from '../../domain/shopping-list/shopping-item-merge.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { Household } from '../../domain/identity/household.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { LinkedAccount } from '../../domain/identity/linked-account.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'
import type { Recipe } from '../../domain/recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../../domain/fridge/product.js'
import type { ProductOutcome, RecordProductOutcomeInput, RecordedProductOutcome } from '../../domain/fridge/product-outcome.js'
import type { ProductOutcomeStats, OutcomeBucket } from '../../domain/fridge/product-outcome-stats.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ProductLookupResult } from '../../domain/fridge/product-lookup-result.js'
import type { ReceiptDraft } from '../../domain/receipt/receipt-draft.js'
import type { Receipt, ImportReceiptInput } from '../../domain/receipt/receipt.js'
import type { FridgeScanDraft, ImportProductsItemInput } from '../../domain/fridge/fridge-scan-draft.js'
import type { AiSettings, AiProvider } from '../../domain/settings/ai-settings.js'
import type { HaLink, HaTodoEntity, SaveHaConnectionInput, BindHaListInput } from '../../domain/home-assistant/ha-link.js'
import type { InstanceInfo } from '../../domain/instance/instance-info.js'

/**
 * How long the fake pretends the AI is thinking, in milliseconds.
 *
 * The fake answered `generateRecipes` synchronously, so the composer's
 * blocking overlay appeared and vanished inside one frame and the flow read as
 * instantaneous — which is the one thing the real call is not. A loader you
 * cannot see is a loader you cannot judge, and every design decision about the
 * wait (what it says, how it moves, whether it blocks) was being made blind.
 *
 * Roughly what a provider takes for a short completion. It is a *fake's*
 * constant: nothing in production reads it.
 */
const DEFAULT_AI_LATENCY_MS = 2200

/** Matches `GetProductOutcomeStats.BUCKET_COUNT` server-side. */
const STATS_BUCKET_COUNT = 6

function sumPrices(outcomes: ProductOutcome[]): number {
  const total = outcomes.reduce((sum, outcome) => sum + (outcome.price ?? 0), 0)
  return Math.round(total * 100) / 100
}

/**
 * `bucketCount` equal-width slices of `[fromMs, toMs]`, oldest first — the
 * same fixed-count bucketing `width_bucket()` does server-side. A zero-width
 * window (no outcomes yet) skips the assignment loop and returns six empty
 * buckets, same as the backend's own edge case.
 */
function bucketOutcomes(
  outcomes: ProductOutcome[],
  fromMs: number,
  toMs: number,
  bucketCount: number,
): OutcomeBucket[] {
  const buckets: OutcomeBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    from: new Date(fromMs + ((toMs - fromMs) * i) / bucketCount).toISOString(),
    to: new Date(fromMs + ((toMs - fromMs) * (i + 1)) / bucketCount).toISOString(),
    discardedCount: 0,
    consumedCount: 0,
  }))
  if (toMs <= fromMs) return buckets

  const width = (toMs - fromMs) / bucketCount
  for (const outcome of outcomes) {
    const t = new Date(outcome.occurredAt).getTime()
    const index = Math.min(Math.floor((t - fromMs) / width), bucketCount - 1)
    const bucket = buckets[index]
    if (!bucket) continue
    if (outcome.kind === 'discarded') bucket.discardedCount += 1
    else bucket.consumedCount += 1
  }
  return buckets
}

/** In-memory only, resets on every reload — UI iteration without a running backend. */
export class FakeFridgeConnector implements FridgeConnector {
  private session: Session | null = null
  /**
   * Nullable, because "signed in with no foyer yet" is a real state the app
   * now has a whole route group for. The fake used to hand every session the
   * same fixture household unconditionally, which made the onboarding
   * literally unreachable in dev: the gate that sends a foyer-less account to
   * `(onboarding)` could never fire against it.
   *
   * Which method leaves it null is the honest part: `signUpEmail` creates a
   * brand-new account and therefore has no foyer, `signInEmail`/`signInSocial`
   * return to one that already exists. So signing up is how you reach the
   * onboarding in dev — the same way you reach it in production, and how a
   * test reaches it too.
   *
   * It still *starts* on the fixture, because most screens are exercised
   * against a connector nobody signed into and they are all foyer screens: a
   * default of null would have made every one of them render its "no
   * household" branch instead of the thing under test.
   */
  private household: Household | null
  /**
   * Which household `restoreFixtureHousehold()` restores to — `fakeHousehold`
   * (owner) unless the constructor is told otherwise. Exists so a test can
   * render an owner-gated screen as a member (`fakeHouseholdAsMember`)
   * without inventing a second, differently-named household via a `getHousehold`
   * mock, which is what every other fixture-backed screen already renders.
   */
  private readonly fixtureHousehold: Household
  private nextInviteCode = 1
  private nextHouseholdId = 2
  private shoppingItems: ShoppingItem[] = fakeShoppingItems.map((item) => ({ ...item }))
  private products: Product[] = fakeProducts.map((p) => ({ ...p }))
  private nextProductId = 1
  /**
   * Every outcome recorded, oldest first — read by tests and by
   * `getProductOutcomeStats()`. Starts seeded with a handful of demo
   * entries (`fakeProductOutcomes`) so `StatsScreen` isn't empty in dev;
   * `recordProductOutcome()` appends real ones on top.
   */
  readonly outcomes: ProductOutcome[] = fakeProductOutcomes.map((o) => ({ ...o }))
  private nextOutcomeId = 1
  private nextShoppingItemId = 1
  private receipts: Receipt[] = fakeReceipts.map((r) => ({ ...r }))
  private nextReceiptId = 1
  /** Counts `fail`-marked URIs seen so far — every third one actually fails. */
  private fridgeScanFailAttempts = 0
  /**
   * A copy, not the module fixture: `deleteRecipe` mutates this list, and a
   * fake that spliced the shared array would delete the recipe for every other
   * connector instance in the same test run.
   */
  private recipes: Recipe[] = fakeRecipes.map((r) => ({ ...r }))
  private generatedRecipes: Recipe[] = []
  private nextRecipeId = 1
  private aiSettings: AiSettings = {
    ...fakeAiSettings,
    availableProviders: [...fakeAiSettings.availableProviders],
    access: { ...fakeAiSettings.access },
  }
  private haLink: HaLink = { ...fakeUnconfiguredHaLink }
  private readonly aiLatencyMs: number

  /**
   * `aiLatencyMs: 0` for tests that want the generated data and not the wait.
   * `fixtureHousehold` for a test that needs the connector to start signed
   * into (and sign back into) the foyer as a member rather than the owner —
   * pass `fakeHouseholdAsMember`.
   */
  constructor({
    aiLatencyMs = DEFAULT_AI_LATENCY_MS,
    fixtureHousehold = fakeHousehold,
  }: { aiLatencyMs?: number; fixtureHousehold?: Household } = {}) {
    this.aiLatencyMs = aiLatencyMs
    this.fixtureHousehold = fixtureHousehold
    this.household = { ...fixtureHousehold, members: fixtureHousehold.members.map((m) => ({ ...m })) }
  }

  private pretendToThink(): Promise<void> {
    if (this.aiLatencyMs <= 0) return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, this.aiLatencyMs))
  }

  /** Fixture answers for a URL ending in `/valid`, `null` (server not recognized) for anything else — see server-choice-screen.test.tsx. */
  async getInstanceInfo(url: string): Promise<InstanceInfo | null> {
    if (!url.includes('valid')) return null
    return { mode: 'hosted', name: 'Garde-manger de test', version: '0.0.0' }
  }

  async getSession(): Promise<Session | null> {
    return this.session
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    return [
      { id: 'password', enabled: true, label: 'Email et mot de passe' },
      { id: 'pocketid', enabled: true, label: 'PocketID' },
    ]
  }

  private restoreFixtureHousehold(): Household {
    this.household = { ...this.fixtureHousehold, members: this.fixtureHousehold.members.map((m) => ({ ...m })) }
    return this.household
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    if (!email || !password) {
      return Result.err({ type: 'invalid_credentials', message: 'Email ou mot de passe invalide.' })
    }
    this.session = { user: { ...fakeSession.user, email } }
    this.restoreFixtureHousehold()
    return Result.ok(this.session)
  }

  async signUpEmail(email: string, _password: string, name: string): Promise<Result<Session, ApiError>> {
    this.session = { user: { ...fakeSession.user, email, name } }
    // A new account has no foyer. This is what makes `(onboarding)` reachable.
    this.household = null
    return Result.ok(this.session)
  }

  async signInSocial(): Promise<Result<Session, ApiError>> {
    this.session = fakeSession
    this.restoreFixtureHousehold()
    return Result.ok(this.session)
  }

  async linkSocial(): Promise<Result<void, ApiError>> {
    return Result.ok(undefined)
  }

  async signOut(): Promise<void> {
    this.session = null
  }

  async getHousehold(): Promise<Household | null> {
    if (!this.household) return null
    return { ...this.household, members: this.household.members.map((m) => ({ ...m })) }
  }

  async createHousehold(name: string): Promise<Result<Household, ApiError>> {
    if (this.household) {
      return Result.err({ type: 'already_in_household', message: 'Vous appartenez déjà à un foyer.' })
    }
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > 80) {
      return Result.err({ type: 'validation_failed', message: 'Le nom du foyer doit faire entre 1 et 80 caractères.' })
    }
    this.household = {
      id: `fake-household-${this.nextHouseholdId++}`,
      name: trimmed,
      // Eight characters of [A-Z0-9], like the real generator — see the fixture.
      inviteCode: this.nextFakeInviteCode(),
      role: 'owner',
      members: [
        {
          userId: this.session?.user.id ?? 'fake-user-1',
          name: this.session?.user.name ?? 'Toi',
          role: 'owner',
          joinedAt: new Date().toISOString(),
        },
      ],
    }
    return Result.ok((await this.getHousehold()) as Household)
  }

  async joinHousehold(inviteCode: string): Promise<Result<Household, ApiError>> {
    if (this.household) {
      return Result.err({ type: 'already_in_household', message: 'Vous appartenez déjà à un foyer.' })
    }
    // Only the fixture's own code opens the fixture foyer; every other
    // well-formed code takes the rejection branch, so both outcomes are
    // reachable in dev without a backend.
    if (normalizeInviteCode(inviteCode) !== fakeHousehold.inviteCode) {
      return Result.err({ type: 'invalid_invite_code', message: "Code d'invitation invalide." })
    }
    // Joining makes you a member, never the owner — and the backend omits
    // `inviteCode` entirely for a member, which is what the Foyer screen gates
    // its invite section on.
    const household = this.restoreFixtureHousehold()
    household.role = 'member'
    delete household.inviteCode
    household.members.push({
      userId: this.session?.user.id ?? 'fake-user-3',
      name: this.session?.user.name ?? 'Toi',
      role: 'member',
      joinedAt: new Date().toISOString(),
    })
    return Result.ok((await this.getHousehold()) as Household)
  }

  private nextFakeInviteCode(): string {
    return `FAKE${String(this.nextInviteCode++).padStart(4, '0')}`
  }

  async renameHousehold(name: string): Promise<Result<Household, ApiError>> {
    if (this.household?.role !== 'owner') {
      return Result.err({ type: 'forbidden', message: 'Seul le propriétaire du foyer peut le renommer.' })
    }
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > 80) {
      return Result.err({ type: 'validation_failed', message: 'Le nom du foyer doit faire entre 1 et 80 caractères.' })
    }
    this.household.name = trimmed
    return Result.ok(this.household)
  }

  async regenerateInviteCode(): Promise<Result<string, ApiError>> {
    if (this.household?.role !== 'owner') {
      return Result.err({ type: 'forbidden', message: 'Seul le propriétaire du foyer peut régénérer le code.' })
    }
    this.household.inviteCode = this.nextFakeInviteCode()
    return Result.ok(this.household.inviteCode)
  }

  async removeHouseholdMember(userId: string): Promise<Result<void, ApiError>> {
    if (this.household?.role !== 'owner') {
      return Result.err({ type: 'forbidden', message: 'Seul le propriétaire du foyer peut retirer un membre.' })
    }
    const index = this.household.members.findIndex((m) => m.userId === userId)
    if (index === -1) return Result.err({ type: 'not_found', message: 'Membre introuvable.' })
    this.household.members.splice(index, 1)
    return Result.ok(undefined)
  }

  async leaveHousehold(): Promise<Result<void, ApiError>> {
    // Null, not "the same household minus me". Either branch of the real
    // backend — an owner deleting the foyer, a member being removed from it —
    // leaves `GET /households/mine` answering null for this account, and the
    // gate that decides where a foyer-less user lands reads exactly that.
    this.household = null
    return Result.ok(undefined)
  }

  async transferHouseholdOwnership(newOwnerId: string): Promise<Result<void, ApiError>> {
    if (this.household?.role !== 'owner') {
      return Result.err({ type: 'not_owner', message: 'Seul le propriétaire du foyer peut faire cette action.' })
    }
    if (newOwnerId === (this.session?.user.id ?? 'fake-user-1')) {
      return Result.err({ type: 'already_owner', message: 'Cette personne est déjà propriétaire du foyer.' })
    }
    const target = this.household.members.find((m) => m.userId === newOwnerId)
    if (!target) return Result.err({ type: 'not_a_member', message: "Cet utilisateur n'est pas membre du foyer." })

    for (const member of this.household.members) {
      member.role = member.userId === newOwnerId ? 'owner' : 'member'
    }
    this.household.role = 'member'
    delete this.household.inviteCode
    return Result.ok(undefined)
  }

  async updateAccountName(name: string): Promise<Result<void, ApiError>> {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return Result.err({ type: 'validation_failed', message: 'Le nom ne peut pas être vide.' })
    }
    if (this.session) this.session = { user: { ...this.session.user, name: trimmed } }
    return Result.ok(undefined)
  }

  async changeAccountPassword(currentPassword: string, newPassword: string): Promise<Result<void, ApiError>> {
    if (!currentPassword || !newPassword) {
      return Result.err({ type: 'invalid_credentials', message: 'Email ou mot de passe invalide.' })
    }
    return Result.ok(undefined)
  }

  async getLinkedAccounts(): Promise<LinkedAccount[]> {
    return [
      { provider: 'password', createdAt: new Date().toISOString() },
      { provider: 'pocketid', createdAt: new Date().toISOString() },
    ]
  }

  async deleteAccount(_password?: string): Promise<Result<void, ApiError>> {
    if (this.household?.role === 'owner' && this.household.members.length > 1) {
      return Result.err({
        type: 'ownership_transfer_required',
        message: 'Transférez la propriété du foyer avant de supprimer votre compte.',
      })
    }
    this.session = null
    this.household = null
    return Result.ok(undefined)
  }

  async getShoppingItems(): Promise<ShoppingItem[]> {
    return [...this.shoppingItems]
  }

  async createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const now = new Date().toISOString()
    // Same "don't duplicate the same product" rule the backend's
    // `CreateShoppingItem` use-case enforces: a checked item is a closed
    // instance (see its own comment), so only an unchecked, same-name line
    // is a merge target.
    const targetName = normalizeShoppingItemName(input.name)
    const target = this.shoppingItems.find(
      (item) => !item.checked && normalizeShoppingItemName(item.name) === targetName,
    )
    if (target) {
      const merged = mergeQuantities(target.quantity, input.quantity)
      if (merged) {
        target.quantity = merged
        target.updatedAt = now
        return Result.ok(target)
      }
    }

    const item: ShoppingItem = {
      id: `fake-item-new-${this.nextShoppingItemId++}`,
      name: input.name,
      quantity: input.quantity,
      checked: false,
      // Was hardcoded to `'manual'` regardless of `input.source` — the real
      // backend requires that field and rejects a request without one, but
      // this fake always "succeeded" anyway, which is why no test caught
      // mobile sending recipe-page adds with it missing.
      source: input.source,
      createdAt: now,
      updatedAt: now,
    }
    this.shoppingItems.push(item)
    return Result.ok(item)
  }

  async updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const item = this.shoppingItems.find((i) => i.id === itemId)
    if (!item) return Result.err({ type: 'not_found', message: 'Article introuvable.' })
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    return Result.ok(item)
  }

  async deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>> {
    const index = this.shoppingItems.findIndex((i) => i.id === itemId)
    if (index === -1) return Result.err({ type: 'not_found', message: 'Article introuvable.' })
    this.shoppingItems.splice(index, 1)
    return Result.ok(undefined)
  }

  async getRecipes(): Promise<Recipe[]> {
    return [...this.generatedRecipes, ...this.recipes]
  }

  async getRecipe(recipeId: string): Promise<Recipe | null> {
    return [...this.generatedRecipes, ...this.recipes].find((r) => r.id === recipeId) ?? null
  }

  /**
   * "J'ai cuisiné": the count goes up and the products the meal used leave the
   * garde-manger — the fake has to model the consumption, because that is the
   * whole point of the action and the dashboard reads the same list.
   */
  async cookRecipe(recipeId: string, productIds: string[]): Promise<Result<Recipe, ApiError>> {
    for (const list of [this.generatedRecipes, this.recipes]) {
      const recipe = list.find((r) => r.id === recipeId)
      if (!recipe) continue
      this.products = this.products.filter((product) => !productIds.includes(product.id))
      const cooked: Recipe = {
        ...recipe,
        cookCount: recipe.cookCount + 1,
        lastCookedAt: new Date().toISOString(),
        lastCookedBy: this.session?.user.id ?? fakeSession.user.id,
      }
      list.splice(list.indexOf(recipe), 1, cooked)
      return Result.ok(cooked)
    }
    return Result.err({ type: 'not_found', message: 'Recette introuvable.' })
  }

  async deleteRecipe(recipeId: string): Promise<Result<void, ApiError>> {
    for (const list of [this.generatedRecipes, this.recipes]) {
      const index = list.findIndex((r) => r.id === recipeId)
      if (index === -1) continue
      list.splice(index, 1)
      return Result.ok(undefined)
    }
    return Result.err({ type: 'not_found', message: 'Recette introuvable.' })
  }

  /**
   * Stands in for the backend's AI call by cooking whatever is closest to
   * expiring — enough to exercise the generate flow's pending/empty/success
   * states without a provider key.
   */
  async generateRecipes(prompt?: string): Promise<Result<Recipe[], ApiError>> {
    // Before the empty-fridge check, not after: the real call spends the same
    // seconds whatever it is about to answer, and a failure that returns
    // instantly while a success takes two seconds teaches the wrong shape.
    await this.pretendToThink()
    const usable = this.products.filter((p) => p.expiresAt !== null)
    if (usable.length === 0) {
      return Result.err({ type: 'no_products', message: 'Ajoute des produits au garde-manger pour générer une recette.' })
    }
    const soonest = [...usable].sort(
      (a, b) => new Date(a.expiresAt ?? 0).getTime() - new Date(b.expiresAt ?? 0).getTime(),
    )
    const used = soonest.slice(0, 3)
    const now = new Date().toISOString()
    const recipe: Recipe = {
      id: `fake-recipe-generated-${this.nextRecipeId++}`,
      createdBy: this.session?.user.id ?? fakeSession.user.id,
      cookCount: 0,
      lastCookedAt: null,
      lastCookedBy: null,
      title: `Idée express : ${used[0].name.toLowerCase()}`,
      description: prompt ? `Généré à partir de : ${prompt}` : 'Généré à partir de ce qu’il faut finir en premier.',
      source: 'ai_generated',
      instructions: used
        .map((product, index) => `${index + 1}. Préparer ${product.name.toLowerCase()} et réserver.`)
        .concat(`${used.length + 1}. Assembler, assaisonner, servir chaud.`)
        .join('\n'),
      preparationTime: 15 + used.length * 5,
      tags: ['anti-gaspi', 'rapide'],
      imageKey: null,
      ingredients: used.map((product, index) => ({
        id: `fake-generated-ingredient-${this.nextRecipeId}-${index}`,
        productId: product.id,
        label: product.name,
        quantity: product.quantity.amount,
        unit: product.quantity.unit,
      })),
      createdAt: now,
    }
    this.generatedRecipes.unshift(recipe)
    return Result.ok([recipe])
  }

  async getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]> {
    let result = this.products
    if (params?.location) result = result.filter((p) => p.location === params.location)
    if (params?.expiringWithinDays) {
      const threshold = Date.now() + params.expiringWithinDays * 24 * 60 * 60 * 1000
      result = result.filter((p) => p.expiresAt !== null && new Date(p.expiresAt).getTime() <= threshold)
    }
    return result
  }

  async getProduct(productId: string): Promise<Product | null> {
    return this.products.find((p) => p.id === productId) ?? null
  }

  async createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>> {
    const now = new Date().toISOString()
    const product: Product = {
      id: `fake-product-new-${this.nextProductId++}`,
      name: input.name,
      quantity: input.quantity,
      location: input.location,
      category: input.category,
      expiresAt: input.expiresAt ?? null,
      openedAt: input.openedAt ?? null,
      openfoodfactId: input.openfoodfactId ?? null,
      categories: input.categories ?? null,
      receiptId: null,
      price: input.price ?? null,
      imageKey: null,
      createdAt: now,
      updatedAt: now,
    }
    this.products.push(product)
    return Result.ok(product)
  }

  async updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>> {
    const product = this.products.find((p) => p.id === productId)
    if (!product) return Result.err({ type: 'product_not_found', message: 'Produit introuvable.' })
    Object.assign(product, patch, { updatedAt: new Date().toISOString() })
    return Result.ok(product)
  }

  async deleteProduct(productId: string): Promise<Result<void, ApiError>> {
    const index = this.products.findIndex((p) => p.id === productId)
    if (index === -1) return Result.err({ type: 'product_not_found', message: 'Produit introuvable.' })
    this.products.splice(index, 1)
    return Result.ok(undefined)
  }

  async recordProductOutcome(
    productId: string,
    input: RecordProductOutcomeInput,
  ): Promise<Result<RecordedProductOutcome, ApiError>> {
    const index = this.products.findIndex((p) => p.id === productId)
    if (index === -1) return Result.err({ type: 'product_not_found', message: 'Produit introuvable.' })
    const product = this.products[index]
    const amount = input.amount ?? product.quantity.amount
    if (!Number.isInteger(amount) || amount < 1 || amount > product.quantity.amount) {
      return Result.err({
        type: 'validation_failed',
        message: `La quantité sortie doit être un entier entre 1 et ${product.quantity.amount}.`,
      })
    }

    const outcome: ProductOutcome = {
      id: `fake-outcome-${this.nextOutcomeId++}`,
      productId,
      recordedBy: this.session?.user.id ?? fakeSession.user.id,
      recipeId: null,
      kind: input.kind,
      discardReason: input.discardReason ?? null,
      productName: product.name,
      category: product.category,
      categories: product.categories,
      location: product.location,
      quantity: { amount, unit: product.quantity.unit },
      // The fake has no initial quantity to prorate against; the current stock is close enough for a demo.
      price:
        product.price === null
          ? null
          : Math.round((product.price * amount * 100) / product.quantity.amount) / 100,
      expiresAt: product.expiresAt,
      occurredAt: new Date().toISOString(),
    }
    this.outcomes.push(outcome)

    if (amount === product.quantity.amount) {
      this.products.splice(index, 1)
      return Result.ok({ product: null, outcome })
    }
    const remaining: Product = {
      ...product,
      quantity: { ...product.quantity, amount: product.quantity.amount - amount },
      updatedAt: new Date().toISOString(),
    }
    this.products.splice(index, 1, remaining)
    return Result.ok({ product: remaining, outcome })
  }

  /**
   * Mirrors `GetProductOutcomeStats`/`LucidProductOutcomeStatsAdapter`
   * server-side: totals + a fixed 6-bucket breakdown over `[from, to]`. No
   * SQL here, just the same arithmetic over the in-memory `outcomes` array.
   */
  async getProductOutcomeStats(days?: number): Promise<ProductOutcomeStats> {
    const toMs = Date.now()
    const fromMs = days ? toMs - days * 24 * 60 * 60 * 1000 : this.earliestOutcomeMs() ?? toMs

    const inWindow = this.outcomes.filter((outcome) => {
      const t = new Date(outcome.occurredAt).getTime()
      return t >= fromMs && t <= toMs
    })
    const discarded = inWindow.filter((o) => o.kind === 'discarded')
    const consumed = inWindow.filter((o) => o.kind === 'consumed')
    const consumedFromRecipe = consumed.filter((o) => o.recipeId !== null).length

    return {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      discarded: { count: discarded.length, value: sumPrices(discarded) },
      consumed: { count: consumed.length, value: sumPrices(consumed) },
      recipeSharePercent: consumed.length === 0 ? 0 : Math.round((consumedFromRecipe / consumed.length) * 100),
      buckets: bucketOutcomes(inWindow, fromMs, toMs, STATS_BUCKET_COUNT),
    }
  }

  private earliestOutcomeMs(): number | null {
    return this.outcomes.reduce<number | null>((earliest, outcome) => {
      const t = new Date(outcome.occurredAt).getTime()
      return earliest === null || t < earliest ? t : earliest
    }, null)
  }

  async getExpiringSoonProducts(days = 3): Promise<Product[]> {
    return this.getProducts({ expiringWithinDays: days })
  }

  async lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    return fakeProductLookup[barcode] ?? null
  }

  async scanReceipt(_imageUri: string): Promise<Result<ReceiptDraft, ApiError>> {
    return Result.ok({ ...fakeReceiptDraft, items: fakeReceiptDraft.items.map((item) => ({ ...item })) })
  }

  /** ponytail: `fail` in the URI fails one attempt in three, to exercise `useFridgeScan`'s partial-failure path without a backend. */
  async scanFridgePhoto(imageUri: string): Promise<Result<FridgeScanDraft, ApiError>> {
    await this.pretendToThink()
    if (imageUri.includes('fail')) {
      this.fridgeScanFailAttempts += 1
      if (this.fridgeScanFailAttempts % 3 === 0) {
        return Result.err({ type: 'extraction_failed', message: "L'analyse de cette photo a échoué." })
      }
    }
    return Result.ok({ items: fakeFridgeScanDraft.items.map((item) => ({ ...item })) })
  }

  async importProducts(items: ImportProductsItemInput[]): Promise<Result<{ products: Product[] }, ApiError>> {
    const now = new Date().toISOString()
    const products: Product[] = items.map((item) => {
      const product: Product = {
        id: `fake-product-from-scan-${this.nextProductId++}`,
        name: item.name,
        quantity: { amount: item.quantity, unit: item.unit },
        location: item.location,
        category: item.category ?? 'Non catégorisé',
        expiresAt: item.expiresAt ?? null,
        openedAt: null,
        categories: null,
        openfoodfactId: null,
        receiptId: null,
        price: null,
        imageKey: null,
        createdAt: now,
        updatedAt: now,
      }
      this.products.push(product)
      return product
    })
    return Result.ok({ products })
  }

  async importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>> {
    const now = new Date().toISOString()
    const receipt: Receipt = {
      id: `fake-receipt-new-${this.nextReceiptId++}`,
      storeName: input.storeName,
      scannedAt: input.scannedAt,
      totalAmount: input.totalAmount,
      imageKey: null,
      itemsCount: input.items.length,
      createdAt: now,
    }
    this.receipts.push(receipt)

    const products: Product[] = input.items.map((item) => {
      const product: Product = {
        id: `fake-product-from-receipt-${this.nextProductId++}`,
        name: item.name,
        quantity: { amount: item.quantity, unit: item.unit },
        location: item.location,
        category: item.category ?? 'Non classé',
        expiresAt: item.expiresAt ?? null,
        openedAt: null,
        categories: null,
        openfoodfactId: null,
        receiptId: receipt.id,
        price: item.price ?? null,
        imageKey: null,
        createdAt: now,
        updatedAt: now,
      }
      this.products.push(product)
      return product
    })

    return Result.ok({ receipt, products })
  }

  async getReceipts(): Promise<Receipt[]> {
    return this.receipts
  }

  async getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null> {
    const receipt = this.receipts.find((r) => r.id === receiptId)
    if (!receipt) return null
    return { receipt, products: this.products.filter((p) => p.receiptId === receiptId) }
  }

  async getAiSettings(): Promise<AiSettings | null> {
    return this.aiSettings
  }

  async setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>> {
    if (!this.aiSettings.availableProviders.includes(provider)) {
      return Result.err({ type: 'provider_not_available', message: "Ce fournisseur n'est pas configuré." })
    }
    this.aiSettings = { ...this.aiSettings, activeProvider: provider }
    return Result.ok(this.aiSettings)
  }

  async startSubscriptionCheckout(): Promise<Result<{ url: string }, ApiError>> {
    return Result.ok({ url: 'https://checkout.stripe.com/fake' })
  }

  async openBillingPortal(): Promise<Result<{ url: string }, ApiError>> {
    return Result.ok({ url: 'https://billing.stripe.com/fake' })
  }

  async getHaLink(): Promise<HaLink | null> {
    return this.haLink
  }

  async saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>> {
    if (!input.token && !this.haLink.tokenSet) {
      return Result.err({ type: 'token_required', message: 'Un jeton est requis pour la première connexion.' })
    }
    this.haLink = { ...this.haLink, configured: true, instanceUrl: input.instanceUrl, tokenSet: true }
    return Result.ok(this.haLink)
  }

  async discoverHaTodoEntities(): Promise<Result<HaTodoEntity[], ApiError>> {
    return Result.ok([
      { entityId: 'todo.courses', friendlyName: 'Courses' },
      { entityId: 'todo.taches', friendlyName: 'Tâches' },
    ])
  }

  async bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>> {
    this.haLink = {
      ...this.haLink,
      todoEntityId: input.todoEntityId ?? this.haLink.todoEntityId,
      todoEntityName: input.todoEntityName ?? this.haLink.todoEntityName,
      direction: input.direction ?? this.haLink.direction,
      enabled: input.enabled ?? this.haLink.enabled,
    }
    return Result.ok(this.haLink)
  }

  async unlinkHa(): Promise<Result<void, ApiError>> {
    this.haLink = { ...fakeUnconfiguredHaLink }
    return Result.ok(undefined)
  }

  async syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>> {
    return Result.ok({ synced: this.haLink.configured && Boolean(this.haLink.todoEntityId) })
  }
}
