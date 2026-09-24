import { Platform } from 'react-native'
import { File } from 'expo-file-system'
import { authClient } from '../auth/auth-client.js'
import { apiFetch, apiFetchMultipart } from './http-client.js'
import { telemetry } from '../telemetry/telemetry.js'
import { Result } from '../../domain/shared/result.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { Household } from '../../domain/identity/household.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { LinkedAccount } from '../../domain/identity/linked-account.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'
import type { Recipe } from '../../domain/recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../../domain/fridge/product.js'
import type { RecordProductOutcomeInput, RecordedProductOutcome } from '../../domain/fridge/product-outcome.js'
import type { ProductOutcomeStats } from '../../domain/fridge/product-outcome-stats.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ProductLookupResult } from '../../domain/fridge/product-lookup-result.js'
import type { Receipt, ImportReceiptInput } from '../../domain/receipt/receipt.js'
import type { ImportProductsItemInput } from '../../domain/fridge/fridge-scan-draft.js'
import type { AiSettings, AiProvider } from '../../domain/settings/ai-settings.js'
import type {
  HaLink,
  HaTodoEntity,
  SaveHaConnectionInput,
  DiscoverHaEntitiesInput,
  BindHaListInput,
} from '../../domain/home-assistant/ha-link.js'
import type { Job, ScanDraft } from '../../domain/job/job.js'
import type { InstanceInfo } from '../../domain/instance/instance-info.js'

function toSession(
  data: { user: { id: string; email: string; name: string; image?: string | null } } | null | undefined,
): Session | null {
  if (!data?.user) return null
  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      image: data.user.image ?? null,
    },
  }
}

/**
 * The auth calls below swallow their errors on purpose — a failed session
 * read must not block startup, and a failed sign-in has its own user-facing
 * message. Swallowed used to mean invisible: the errors went to
 * `console.warn`, i.e. to a device log nobody reads, carrying whatever the
 * auth client happened to put in the object.
 *
 * They now go to telemetry as an operation name plus an error *type* — never
 * the error's own message or payload, which for these particular calls can
 * contain the credentials that were being verified. The raw object is still
 * printed in development, where it is a local console and not a data store.
 */
function reportFailure(operation: string, error: unknown): void {
  if (__DEV__) console.warn(`[${operation}]`, error)
  telemetry.recordError(`${operation} failed`, { error, attributes: { 'app.operation': operation } })
}

/**
 * Shared by `enqueueReceiptScan` and `enqueueFridgeScan` — same `file://`/`blob:`
 * URI-to-`FormData`-part dance either way, see the comment this used to
 * carry alone in the receipt enqueue below.
 */
async function appendImagePart(
  formData: FormData,
  imageUri: string,
  filename: string,
  field = 'image',
): Promise<void> {
  // The old RN `{ uri, name, type }` shim is dead: since Expo SDK 53,
  // `expo/fetch` replaces both `fetch` and `FormData.prototype.append`
  // globally (native included, not just web — see
  // `expo/src/winter/runtime.native.ts` and `FormData.ts`), and its
  // WinterCG-style `FormData` only accepts a string or a real
  // Blob/File-like part with a `.bytes()`/Blob interface. Appending the
  // shim object now throws "Unsupported FormDataPart implementation" —
  // silently, with the request never leaving the device, no matter the
  // platform.
  if (Platform.OS === 'web') {
    // `imageUri` here is a `blob:`/`data:` URL the picker/camera already
    // produced in-memory — re-fetching it just hands back the same bytes
    // as a real Blob. `expo-file-system`'s `File` (below) is native-only.
    const blob = await (await fetch(imageUri)).blob()
    formData.append(field, blob, filename)
  } else {
    // `File` implements the `Blob` interface, so it's exactly the kind of
    // part `expo/fetch`'s `FormData` expects — reading a local `file://`
    // URI into a real Blob without a manual `fetch`+`.blob()` round-trip,
    // which isn't guaranteed to work against `file://` on the new fetch.
    formData.append(field, new File(imageUri), filename)
  }
}

const SESSION_TIMEOUT_MS = 5000

/**
 * A session check that fails (unreachable server, timeout, error response) is
 * treated as a closed session: the stored cookie is dropped and `null` sends
 * the gates to sign-in, rather than leaving a half-alive session behind.
 */
function closeSession(action: string, error: unknown): null {
  reportFailure(action, error)
  authClient.signOut().catch(() => {})
  return null
}

export class HttpFridgeConnector implements FridgeConnector {
  /** Raw `fetch`, not `apiFetch`: `url` is a candidate server, not necessarily the one currently configured — this must never read `getServerUrl()`. */
  async getInstanceInfo(url: string): Promise<InstanceInfo | null> {
    try {
      const response = await fetch(`${url.replace(/\/+$/, '')}/api/public/instance`)
      if (!response.ok) return null
      const body = await response.json()
      if (body?.mode !== 'hosted' && body?.mode !== 'self-hosted') return null
      return body as InstanceInfo
    } catch (error) {
      reportFailure('instance.get_instance_info', error)
      return null
    }
  }

  async getSession(): Promise<Session | null> {
    // Aborted rather than left to the OS: an unreachable server otherwise
    // holds the launch gates (which render nothing while this is pending)
    // on a blank screen for the length of the TCP timeout. `null` falls through
    // to the sign-in gate, which is where a dead server now shows up.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS)
    try {
      const { data, error } = await authClient.getSession({ fetchOptions: { signal: controller.signal } })
      if (error) return closeSession('identity.get_session', error)
      return toSession(data)
    } catch (error) {
      return closeSession('identity.get_session', error)
    } finally {
      clearTimeout(timer)
    }
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    try {
      const result = await apiFetch<{ methods: AuthMethod[] }>('/api/auth/methods', undefined, {
        action: 'identity.get_auth_methods',
      })
      return result.ok ? result.value.methods : []
    } catch (error) {
      reportFailure('identity.get_auth_methods', error)
      return []
    }
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    try {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_in_email', error)
      return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    }
  }

  async signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>> {
    try {
      const { error } = await authClient.signUp.email({ email, password, name })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_up_failed', message: error.message ?? 'Inscription impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_up_email', error)
      return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
    }
  }

  async signInSocial(provider: 'pocketid' | 'google'): Promise<Result<Session, ApiError>> {
    try {
      // better-auth validates callbackURL as a plain path — Expo Router's
      // `(tabs)` route-group syntax isn't one (the parens fail its check
      // server-side with 403 INVALID_CALLBACK_URL, before PocketID is ever
      // reached). `onSuccess()` below does the actual in-app navigation, so
      // this only needs to be *a* valid path.
      const { error } = await authClient.signIn.social({ provider, callbackURL: '/' })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_in_social', error)
      return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    }
  }

  async linkSocial(provider: 'pocketid' | 'google'): Promise<Result<void, ApiError>> {
    try {
      const { error } = await authClient.linkSocial({ provider, callbackURL: '/' })
      if (error) {
        return Result.err({ type: error.code ?? 'link_failed', message: error.message ?? 'Connexion impossible.' })
      }
      return Result.ok(undefined)
    } catch (error) {
      reportFailure('identity.link_social', error)
      return Result.err({ type: 'link_failed', message: 'Connexion impossible.' })
    }
  }

  /**
   * Swallows on purpose, like every other identity method here — a failed
   * sign-out must not strand a screen mid-navigation. Whatever went wrong
   * server-side, every caller clears its own local session state and
   * navigates to `/(auth)/sign-in` right after this resolves, so "best
   * effort, continue anyway" is the same trade `getSession` already makes.
   */
  async signOut(): Promise<void> {
    try {
      await authClient.signOut()
    } catch (error) {
      reportFailure('identity.sign_out', error)
    }
  }

  /**
   * `null` means the server said this account has no foyer. A failed read
   * **throws**, so TanStack marks the query `isError` rather than `data: null`.
   *
   * It used to answer `null` for both, and that conflation is now load-bearing
   * in the wrong direction: `(tabs)/_layout` reads this query to decide
   * whether to send someone to the onboarding, so a dropped connection in a
   * kitchen on one bar of signal would have told an existing member their
   * foyer was gone and offered them a form to create a second one. The Foyer
   * screen's own `isError` branch — three states, written precisely so a
   * failed read is not reported as "tu n'appartiens à aucun foyer" — could
   * never fire either, for the same reason.
   */
  async getHousehold(): Promise<Household | null> {
    const result = await apiFetch<{ household: Household | null }>('/api/households/mine', undefined, {
      action: 'identity.get_household',
    })
    if (!result.ok) throw new Error(result.error.message)
    return result.value.household
  }

  async createHousehold(name: string): Promise<Result<Household, ApiError>> {
    const result = await apiFetch<{ household: Household }>(
      '/api/households',
      { method: 'POST', body: JSON.stringify({ name }) },
      { action: 'identity.create_household' },
    )
    return result.ok ? Result.ok(result.value.household) : Result.err(result.error)
  }

  async joinHousehold(inviteCode: string): Promise<Result<Household, ApiError>> {
    const result = await apiFetch<{ household: Household }>(
      '/api/households/join',
      { method: 'POST', body: JSON.stringify({ inviteCode }) },
      { action: 'identity.join_household' },
    )
    return result.ok ? Result.ok(result.value.household) : Result.err(result.error)
  }

  async renameHousehold(name: string): Promise<Result<Household, ApiError>> {
    const result = await apiFetch<{ household: Household }>(
      '/api/households/mine',
      { method: 'PATCH', body: JSON.stringify({ name }) },
      { action: 'identity.rename_household' },
    )
    return result.ok ? Result.ok(result.value.household) : Result.err(result.error)
  }

  async regenerateInviteCode(): Promise<Result<string, ApiError>> {
    const result = await apiFetch<{ inviteCode: string }>(
      '/api/households/invite-code/regenerate',
      { method: 'POST' },
      { action: 'identity.regenerate_invite_code' },
    )
    return result.ok ? Result.ok(result.value.inviteCode) : Result.err(result.error)
  }

  async removeHouseholdMember(userId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      `/api/households/members/${userId}`,
      { method: 'DELETE' },
      { action: 'identity.remove_household_member', attributes: { 'entity.id': userId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async leaveHousehold(): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      '/api/households/leave',
      { method: 'POST' },
      { action: 'identity.leave_household' },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async transferHouseholdOwnership(newOwnerId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      '/api/households/transfer-ownership',
      { method: 'POST', body: JSON.stringify({ newOwnerId }) },
      { action: 'identity.transfer_household_ownership', attributes: { 'entity.id': newOwnerId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async updateAccountName(name: string): Promise<Result<void, ApiError>> {
    try {
      const { error } = await authClient.updateUser({ name })
      if (error) {
        return Result.err({ type: error.code ?? 'update_failed', message: error.message ?? 'Mise à jour impossible.' })
      }
      return Result.ok(undefined)
    } catch (error) {
      reportFailure('identity.update_account_name', error)
      return Result.err({ type: 'update_failed', message: 'Mise à jour impossible.' })
    }
  }

  async changeAccountPassword(currentPassword: string, newPassword: string): Promise<Result<void, ApiError>> {
    try {
      const { error } = await authClient.changePassword({ currentPassword, newPassword })
      if (error) {
        return Result.err({ type: error.code ?? 'change_password_failed', message: error.message ?? 'Changement de mot de passe impossible.' })
      }
      return Result.ok(undefined)
    } catch (error) {
      reportFailure('identity.change_account_password', error)
      return Result.err({ type: 'change_password_failed', message: 'Changement de mot de passe impossible.' })
    }
  }

  async getLinkedAccounts(): Promise<LinkedAccount[]> {
    try {
      const [{ data, error }, passkeys] = await Promise.all([
        authClient.listAccounts(),
        // Passkeys live in their own table (`passkey`), separate from
        // credential/OAuth accounts (`account`) — better-auth exposes them
        // through a dedicated endpoint rather than `listAccounts`.
        authClient.passkey.listUserPasskeys().catch(() => ({ data: [] })),
      ])
      if (error || !data) return []
      const accounts: LinkedAccount[] = data.map((account) => ({
        provider: account.providerId === 'pocketid' || account.providerId === 'google' ? account.providerId : 'password',
        createdAt: new Date(account.createdAt).toISOString(),
      }))
      if ((passkeys.data ?? []).length > 0) {
        // One row per *provider*, not per credential — the account screen
        // lists login methods, not every individual passkey a user registered.
        accounts.push({ provider: 'passkey', createdAt: new Date(passkeys.data![0].createdAt).toISOString() })
      }
      return accounts
    } catch (error) {
      reportFailure('identity.get_linked_accounts', error)
      return []
    }
  }

  async deleteAccount(password?: string): Promise<Result<void, ApiError>> {
    try {
      const { error } = await authClient.deleteUser(password ? { password } : {})
      if (error) {
        return Result.err({ type: error.code ?? 'delete_account_failed', message: error.message ?? 'Suppression du compte impossible.' })
      }
      return Result.ok(undefined)
    } catch (error) {
      reportFailure('identity.delete_account', error)
      return Result.err({ type: 'delete_account_failed', message: 'Suppression du compte impossible.' })
    }
  }

  async getShoppingItems(): Promise<ShoppingItem[]> {
    const result = await apiFetch<{ items: ShoppingItem[] }>('/api/shopping-items', undefined, {
      action: 'shopping_list.get_items',
    })
    return result.ok ? result.value.items : []
  }

  async createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>(
      '/api/shopping-items',
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'shopping_list.create_item' },
    )
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>(
      `/api/shopping-items/${itemId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      { action: 'shopping_list.update_item', attributes: { 'entity.id': itemId } },
    )
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      `/api/shopping-items/${itemId}`,
      { method: 'DELETE' },
      { action: 'shopping_list.delete_item', attributes: { 'entity.id': itemId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getRecipes(): Promise<Recipe[]> {
    const result = await apiFetch<{ recipes: Recipe[] }>('/api/recipes', undefined, { action: 'recipe.get_recipes' })
    return result.ok ? result.value.recipes : []
  }

  async getRecipe(recipeId: string): Promise<Recipe | null> {
    const result = await apiFetch<{ recipe: Recipe }>(`/api/recipes/${recipeId}`, undefined, {
      action: 'recipe.get_recipe',
      attributes: { 'entity.id': recipeId },
    })
    return result.ok ? result.value.recipe : null
  }

  async enqueueRecipeGeneration(prompt?: string): Promise<Result<Job, ApiError>> {
    const result = await apiFetch<{ job: Job }>(
      '/api/jobs/recipe-generation',
      { method: 'POST', body: JSON.stringify(prompt ? { prompt } : {}) },
      { action: 'job.enqueue_recipe_generation' },
    )
    return result.ok ? Result.ok(result.value.job) : Result.err(result.error)
  }

  async cookRecipe(recipeId: string, productIds: string[]): Promise<Result<Recipe, ApiError>> {
    const result = await apiFetch<{ recipe: Recipe }>(
      `/api/recipes/${recipeId}/cooked`,
      { method: 'POST', body: JSON.stringify({ productIds }) },
      { action: 'recipe.cook_recipe', attributes: { 'entity.id': recipeId } },
    )
    return result.ok ? Result.ok(result.value.recipe) : Result.err(result.error)
  }

  async deleteRecipe(recipeId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      `/api/recipes/${recipeId}`,
      { method: 'DELETE' },
      { action: 'recipe.delete_recipe', attributes: { 'entity.id': recipeId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]> {
    const query = new URLSearchParams()
    if (params?.location) query.set('location', params.location)
    if (params?.expiringWithinDays) query.set('expiringWithinDays', String(params.expiringWithinDays))
    const qs = query.toString()
    const result = await apiFetch<{ products: Product[] }>(`/api/products${qs ? `?${qs}` : ''}`, undefined, {
      action: 'fridge.get_products',
    })
    return result.ok ? result.value.products : []
  }

  async getProduct(productId: string): Promise<Product | null> {
    const result = await apiFetch<{ product: Product }>(`/api/products/${productId}`, undefined, {
      action: 'fridge.get_product',
      attributes: { 'entity.id': productId },
    })
    return result.ok ? result.value.product : null
  }

  async createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>> {
    const result = await apiFetch<{ product: Product }>(
      '/api/products',
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'fridge.create_product' },
    )
    return result.ok ? Result.ok(result.value.product) : Result.err(result.error)
  }

  async updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>> {
    const result = await apiFetch<{ product: Product }>(
      `/api/products/${productId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      { action: 'fridge.update_product', attributes: { 'entity.id': productId } },
    )
    return result.ok ? Result.ok(result.value.product) : Result.err(result.error)
  }

  async deleteProduct(productId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      `/api/products/${productId}`,
      { method: 'DELETE' },
      { action: 'fridge.delete_product', attributes: { 'entity.id': productId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async recordProductOutcome(
    productId: string,
    input: RecordProductOutcomeInput,
  ): Promise<Result<RecordedProductOutcome, ApiError>> {
    const result = await apiFetch<RecordedProductOutcome>(
      `/api/products/${productId}/outcomes`,
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'fridge.record_product_outcome', attributes: { 'entity.id': productId } },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async getProductOutcomeStats(days?: number): Promise<ProductOutcomeStats> {
    const qs = days ? `?days=${days}` : ''
    const result = await apiFetch<{ stats: ProductOutcomeStats }>(`/api/products/outcomes/stats${qs}`, undefined, {
      action: 'fridge.get_product_outcome_stats',
    })
    if (!result.ok) throw new Error(result.error.message)
    return result.value.stats
  }

  async getExpiringSoonProducts(days?: number): Promise<Product[]> {
    const qs = days ? `?days=${days}` : ''
    const result = await apiFetch<{ products: Product[] }>(`/api/products/expiring-soon${qs}`, undefined, {
      action: 'fridge.get_expiring_soon_products',
    })
    return result.ok ? result.value.products : []
  }

  /**
   * `null` means the barcode is real but OpenFoodFacts has nothing for it —
   * a legitimate outcome the form turns into "remplis les champs à la main".
   * A failed request **throws**, same convention as `getHousehold`: it must
   * not collapse into that same `null`, or a dropped connection reads as
   * "this product doesn't exist" instead of "we couldn't check".
   */
  async lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    const result = await apiFetch<{ result: ProductLookupResult | null }>(
      `/api/products/lookup?barcode=${encodeURIComponent(barcode)}`,
      undefined,
      { action: 'fridge.lookup_product' },
    )
    if (!result.ok) throw new Error(result.error.message)
    return result.value.result
  }

  async enqueueReceiptScan(imageUri: string): Promise<Result<Job, ApiError>> {
    const formData = new FormData()
    // A hardcoded ".jpg" here used to route every PDF import through the
    // backend's extname-based content-type sniff as a JPEG — a receipt
    // scanned as a PDF has to keep its extension to be read as one.
    const filename = imageUri.toLowerCase().endsWith('.pdf') ? 'receipt.pdf' : 'receipt.jpg'
    await appendImagePart(formData, imageUri, filename)
    const result = await apiFetchMultipart<{ job: Job }>('/api/jobs/receipt-scan', formData, {
      action: 'job.enqueue_receipt_scan',
    })
    return result.ok ? Result.ok(result.value.job) : Result.err(result.error)
  }

  async enqueueFridgeScan(imageUris: string[]): Promise<Result<Job, ApiError>> {
    const formData = new FormData()
    for (const [index, uri] of imageUris.entries()) {
      await appendImagePart(formData, uri, `fridge-${index}.jpg`, 'images')
    }
    const result = await apiFetchMultipart<{ job: Job }>('/api/jobs/fridge-scan', formData, {
      action: 'job.enqueue_fridge_scan',
    })
    return result.ok ? Result.ok(result.value.job) : Result.err(result.error)
  }

  async importProducts(items: ImportProductsItemInput[], draftId?: string): Promise<Result<{ products: Product[] }, ApiError>> {
    const result = await apiFetch<{ products: Product[] }>(
      '/api/products/import',
      { method: 'POST', body: JSON.stringify({ items, draftId }) },
      { action: 'fridge.import' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>> {
    const result = await apiFetch<{ receipt: Receipt; products: Product[] }>(
      '/api/receipts/import',
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'receipt.import' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async getJobs(): Promise<Job[]> {
    const result = await apiFetch<{ jobs: Job[] }>('/api/jobs', undefined, { action: 'job.get_jobs' })
    return result.ok ? result.value.jobs : []
  }

  async getJob(jobId: string): Promise<Job | null> {
    const result = await apiFetch<{ job: Job }>(`/api/jobs/${jobId}`, undefined, {
      action: 'job.get_job',
      attributes: { 'entity.id': jobId },
    })
    return result.ok ? result.value.job : null
  }

  async retryJob(jobId: string): Promise<Result<Job, ApiError>> {
    const result = await apiFetch<{ job: Job }>(
      `/api/jobs/${jobId}/retry`,
      { method: 'POST' },
      { action: 'job.retry', attributes: { 'entity.id': jobId } },
    )
    return result.ok ? Result.ok(result.value.job) : Result.err(result.error)
  }

  async dismissJob(jobId: string): Promise<Result<void, ApiError>> {
    return apiFetch<void>(
      `/api/jobs/${jobId}`,
      { method: 'DELETE' },
      { action: 'job.dismiss', attributes: { 'entity.id': jobId } },
    )
  }

  async restoreJob(jobId: string): Promise<Result<void, ApiError>> {
    return apiFetch<void>(
      `/api/jobs/${jobId}/restore`,
      { method: 'POST' },
      { action: 'job.restore', attributes: { 'entity.id': jobId } },
    )
  }

  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<Result<void, ApiError>> {
    return apiFetch<void>(
      '/api/push-tokens',
      { method: 'POST', body: JSON.stringify({ token, platform }) },
      { action: 'push.register' },
    )
  }

  async unregisterPushToken(token: string): Promise<Result<void, ApiError>> {
    return apiFetch<void>(
      '/api/push-tokens',
      { method: 'DELETE', body: JSON.stringify({ token }) },
      { action: 'push.unregister' },
    )
  }

  async getScanDrafts(): Promise<ScanDraft[]> {
    const result = await apiFetch<{ drafts: ScanDraft[] }>('/api/scan-drafts', undefined, {
      action: 'job.get_scan_drafts',
    })
    return result.ok ? result.value.drafts : []
  }

  async getScanDraft(draftId: string): Promise<ScanDraft | null> {
    const result = await apiFetch<{ draft: ScanDraft }>(`/api/scan-drafts/${draftId}`, undefined, {
      action: 'job.get_scan_draft',
      attributes: { 'entity.id': draftId },
    })
    return result.ok ? result.value.draft : null
  }

  async discardScanDraft(draftId: string): Promise<Result<void, ApiError>> {
    return apiFetch<void>(
      `/api/scan-drafts/${draftId}`,
      { method: 'DELETE' },
      { action: 'job.discard_scan_draft', attributes: { 'entity.id': draftId } },
    )
  }

  async getReceipts(): Promise<Receipt[]> {
    const result = await apiFetch<{ receipts: Receipt[] }>('/api/receipts', undefined, {
      action: 'receipt.get_receipts',
    })
    return result.ok ? result.value.receipts : []
  }

  async getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null> {
    const result = await apiFetch<{ receipt: Receipt; products: Product[] }>(`/api/receipts/${receiptId}`, undefined, {
      action: 'receipt.get_receipt',
      attributes: { 'entity.id': receiptId },
    })
    return result.ok ? result.value : null
  }

  async getAiSettings(): Promise<AiSettings | null> {
    const result = await apiFetch<AiSettings>('/api/settings/ai', undefined, { action: 'settings.get_ai_settings' })
    return result.ok ? result.value : null
  }

  async setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>> {
    const result = await apiFetch<AiSettings>(
      '/api/settings/ai',
      { method: 'PATCH', body: JSON.stringify({ provider }) },
      { action: 'settings.set_active_ai_provider' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async startSubscriptionCheckout(): Promise<Result<{ url: string }, ApiError>> {
    const result = await apiFetch<{ url: string }>(
      '/api/settings/subscription/checkout',
      { method: 'POST' },
      { action: 'settings.start_checkout' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async openBillingPortal(): Promise<Result<{ url: string }, ApiError>> {
    const result = await apiFetch<{ url: string }>(
      '/api/settings/subscription/portal',
      { method: 'POST' },
      { action: 'settings.open_billing_portal' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async getHaLink(): Promise<HaLink | null> {
    const result = await apiFetch<HaLink>('/api/settings/home-assistant', undefined, {
      action: 'home_assistant.get_link',
    })
    if (__DEV__) {
      // `JSON.stringify`, not the object itself: RN's console truncates a
      // nested array of objects (Vine's `details`) to `[Object]`, which is
      // exactly the part worth reading when the error is `validation_failed`.
      console.log('[home_assistant.get_link]', result.ok ? { configured: result.value.configured } : JSON.stringify({ error: result.error }))
    }
    return result.ok ? result.value : null
  }

  async saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>> {
    // Never the token, per the same rule the backend client follows.
    if (__DEV__) console.log('[home_assistant.save_connection] connecting', { instanceUrl: input.instanceUrl })
    const result = await apiFetch<HaLink>(
      '/api/settings/home-assistant',
      { method: 'PUT', body: JSON.stringify(input) },
      { action: 'home_assistant.save_connection' },
    )
    if (__DEV__) {
      console.log('[home_assistant.save_connection]', result.ok ? 'connected' : JSON.stringify({ error: result.error }))
    }
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async discoverHaTodoEntities(input: DiscoverHaEntitiesInput): Promise<Result<HaTodoEntity[], ApiError>> {
    if (__DEV__) console.log('[home_assistant.discover] connecting', { instanceUrl: input.instanceUrl })
    const result = await apiFetch<{ entities: HaTodoEntity[] }>(
      '/api/settings/home-assistant/discover',
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'home_assistant.discover' },
    )
    if (__DEV__) {
      console.log('[home_assistant.discover]', result.ok ? { entities: result.value.entities.length } : JSON.stringify({ error: result.error }))
    }
    return result.ok ? Result.ok(result.value.entities) : Result.err(result.error)
  }

  async bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>> {
    const result = await apiFetch<HaLink>(
      '/api/settings/home-assistant',
      { method: 'PATCH', body: JSON.stringify(input) },
      { action: 'home_assistant.bind_list' },
    )
    if (__DEV__) console.log('[home_assistant.bind_list]', result.ok ? { entity: input.todoEntityId } : JSON.stringify({ error: result.error }))
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async unlinkHa(): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      '/api/settings/home-assistant',
      { method: 'DELETE' },
      { action: 'home_assistant.unlink' },
    )
    if (__DEV__) console.log('[home_assistant.unlink]', result.ok ? 'ok' : { error: result.error })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>> {
    const result = await apiFetch<{ synced: boolean }>(
      '/api/shopping-items/sync',
      { method: 'POST' },
      { action: 'home_assistant.sync_shopping_list' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }
}
