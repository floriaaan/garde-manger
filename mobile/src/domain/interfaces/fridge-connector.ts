import type { Result } from '../shared/result.js'
import type { ApiError } from '../shared/api-error.js'
import type { Session } from '../identity/session.js'
import type { Household } from '../identity/household.js'
import type { AuthMethod } from '../identity/auth-method.js'
import type { LinkedAccount } from '../identity/linked-account.js'
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../shopping-list/shopping-item.js'
import type { Recipe } from '../recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../fridge/product.js'
import type { RecordProductOutcomeInput, RecordedProductOutcome } from '../fridge/product-outcome.js'
import type { ProductOutcomeStats } from '../fridge/product-outcome-stats.js'
import type { LocationValue } from '../fridge/location.js'
import type { ProductLookupResult } from '../fridge/product-lookup-result.js'
import type { Receipt, ImportReceiptInput } from '../receipt/receipt.js'
import type { ImportProductsItemInput } from '../fridge/fridge-scan-draft.js'
import type { AiSettings, AiProvider } from '../settings/ai-settings.js'
import type {
  HaLink,
  HaTodoEntity,
  SaveHaConnectionInput,
  DiscoverHaEntitiesInput,
  BindHaListInput,
} from '../home-assistant/ha-link.js'
import type { Job, ScanDraft } from '../job/job.js'
import type { InstanceInfo } from '../instance/instance-info.js'

/**
 * The app's one abstraction boundary over the backend. Extended by one
 * method group per bounded context, one phase at a time — never a
 * placeholder method for a context this phase doesn't build.
 */
export interface FridgeConnector {
  /**
   * Pings `GET /api/public/instance` on a candidate server URL — used both
   * by the server-choice onboarding screen (validating what the user typed
   * before saving it) and by Réglages (showing what the current one is).
   * `null` means the URL didn't answer like a Garde-manger server.
   */
  getInstanceInfo(url: string): Promise<InstanceInfo | null>
  getSession(): Promise<Session | null>
  getAuthMethods(): Promise<AuthMethod[]>
  signInEmail(email: string, password: string): Promise<Result<Session, ApiError>>
  signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>>
  signInSocial(provider: 'pocketid' | 'google'): Promise<Result<Session, ApiError>>
  /** Explicit linking from an authenticated session — the only path the backend allows, cf. account-linking security notes in `instance.ts`. */
  linkSocial(provider: 'pocketid' | 'google'): Promise<Result<void, ApiError>>
  signOut(): Promise<void>
  getHousehold(): Promise<Household | null>
  /**
   * The two ways an account acquires a foyer. Both return the household the
   * caller now belongs to, so the screen that called them can seed the
   * `['household']` query instead of racing the gate that is about to read it.
   */
  createHousehold(name: string): Promise<Result<Household, ApiError>>
  joinHousehold(inviteCode: string): Promise<Result<Household, ApiError>>
  regenerateInviteCode(): Promise<Result<string, ApiError>>
  /** Owner only. Returns the renamed household. */
  renameHousehold(name: string): Promise<Result<Household, ApiError>>
  removeHouseholdMember(userId: string): Promise<Result<void, ApiError>>
  leaveHousehold(): Promise<Result<void, ApiError>>
  transferHouseholdOwnership(newOwnerId: string): Promise<Result<void, ApiError>>
  updateAccountName(name: string): Promise<Result<void, ApiError>>
  changeAccountPassword(currentPassword: string, newPassword: string): Promise<Result<void, ApiError>>
  getLinkedAccounts(): Promise<LinkedAccount[]>
  /**
   * `password` re-proves a fresh session for password accounts. SSO-only
   * accounts have none to give — omit it and better-auth falls back to its
   * own session-freshness check instead.
   */
  deleteAccount(password?: string): Promise<Result<void, ApiError>>
  getShoppingItems(): Promise<ShoppingItem[]>
  createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>
  updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>
  deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>>
  getRecipes(): Promise<Recipe[]>
  getRecipe(recipeId: string): Promise<Recipe | null>
  /**
   * `POST /api/jobs/recipe-generation` — answers at once with a queued job; the
   * backend saves the recipes when the job succeeds, so the recipe list is stale then.
   */
  enqueueRecipeGeneration(prompt?: string): Promise<Result<Job, ApiError>>
  deleteRecipe(recipeId: string): Promise<Result<void, ApiError>>
  /**
   * "J'ai cuisiné." `productIds` are the garde-manger products this meal used
   * up — sent from here because this is where the rapprochement between an
   * ingredient and a real product was confirmed; the backend never guesses it.
   */
  cookRecipe(recipeId: string, productIds: string[]): Promise<Result<Recipe, ApiError>>
  getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]>
  getProduct(productId: string): Promise<Product | null>
  createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>>
  updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>>
  deleteProduct(productId: string): Promise<Result<void, ApiError>>
  /** Eaten or thrown away — logged for the foyer's statistics. `deleteProduct` is for data-entry mistakes only. */
  recordProductOutcome(
    productId: string,
    input: RecordProductOutcomeInput,
  ): Promise<Result<RecordedProductOutcome, ApiError>>
  /**
   * Waste stats over a window (docs/superpowers/specs/2026-09-14-waste-stats-design.md).
   * `days` omitted = since the foyer's very first outcome. No `Result`
   * wrapper — a pure read, like `getProducts`.
   */
  getProductOutcomeStats(days?: number): Promise<ProductOutcomeStats>
  getExpiringSoonProducts(days?: number): Promise<Product[]>
  lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null>
  /** One job for all the photos (docs/superpowers/specs/2026-09-20-taches-ia-asynchrones-design.md) — the server merges the results into a single draft. */
  enqueueFridgeScan(imageUris: string[]): Promise<Result<Job, ApiError>>
  importProducts(items: ImportProductsItemInput[], draftId?: string): Promise<Result<{ products: Product[] }, ApiError>>
  enqueueReceiptScan(imageUri: string): Promise<Result<Job, ApiError>>
  importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>>
  /** Recent and still-active jobs of the foyer — what the task center and the polling read. */
  getJobs(): Promise<Job[]>
  getJob(jobId: string): Promise<Job | null>
  /** Failed jobs, and scans that missed some photos (only those replay). */
  retryJob(jobId: string): Promise<Result<Job, ApiError>>
  /** Cancels a queued job, hides a finished one. A running job is left alone. */
  dismissJob(jobId: string): Promise<Result<void, ApiError>>
  getScanDrafts(): Promise<ScanDraft[]>
  getScanDraft(draftId: string): Promise<ScanDraft | null>
  discardScanDraft(draftId: string): Promise<Result<void, ApiError>>
  getReceipts(): Promise<Receipt[]>
  getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null>
  getAiSettings(): Promise<AiSettings | null>
  setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>>
  /** Stripe-hosted page to subscribe (Checkout) or to manage/cancel (billing portal) — opened in a browser, never in-app (ADR 0015). */
  startSubscriptionCheckout(): Promise<Result<{ url: string }, ApiError>>
  openBillingPortal(): Promise<Result<{ url: string }, ApiError>>
  getHaLink(): Promise<HaLink | null>
  saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>>
  discoverHaTodoEntities(input: DiscoverHaEntitiesInput): Promise<Result<HaTodoEntity[], ApiError>>
  bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>>
  unlinkHa(): Promise<Result<void, ApiError>>
  syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>>
}
