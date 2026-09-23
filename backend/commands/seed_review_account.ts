import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { Email } from '#domain/identity/email.vo'
import type { Clock } from '#domain/shared/clock.interface'
import { CreateHousehold } from '#application/identity/create-household.use-case'
import { CreateProduct } from '#application/fridge/create-product.use-case'
import { RecordProductOutcome } from '#application/fridge/record-product-outcome.use-case'
import { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'

const DAY = 24 * 60 * 60 * 1000
const USER_NAME = 'Camille Martin'
const HOUSEHOLD_NAME = 'Maison Martin'

interface StockSeed {
  name: string
  amount: number
  unit: string
  location: 'fridge' | 'freezer' | 'pantry'
  category: string
  /** Days from today; `null` = no date (pantry staples, frozen food). Negative = already expired. */
  expiresIn: number | null
  openedDaysAgo?: number
  price?: number
}

/** What is in the garde-manger today: dates spread so the dashboard shows every state. */
// prettier-ignore
const STOCK: StockSeed[] = [
  { name: 'Yaourts nature', amount: 4, unit: 'pièce', location: 'fridge', category: 'Produits laitiers', expiresIn: 1, price: 1.95 },
  { name: 'Lait demi-écrémé', amount: 1, unit: 'L', location: 'fridge', category: 'Produits laitiers', expiresIn: 2, openedDaysAgo: 2, price: 1.1 },
  { name: 'Blancs de poulet', amount: 400, unit: 'g', location: 'fridge', category: 'Viandes', expiresIn: 1, price: 5.9 },
  { name: 'Crème fraîche', amount: 20, unit: 'cl', location: 'fridge', category: 'Produits laitiers', expiresIn: 3, price: 1.45 },
  { name: 'Salade verte', amount: 1, unit: 'pièce', location: 'fridge', category: 'Légumes', expiresIn: 2, price: 0.99 },
  { name: 'Jambon blanc', amount: 4, unit: 'tranche', location: 'fridge', category: 'Charcuterie', expiresIn: -1, price: 2.6 },
  { name: 'Comté', amount: 250, unit: 'g', location: 'fridge', category: 'Fromages', expiresIn: 12, price: 4.2 },
  { name: 'Œufs', amount: 6, unit: 'pièce', location: 'fridge', category: 'Œufs', expiresIn: 14, price: 2.3 },
  { name: 'Beurre doux', amount: 250, unit: 'g', location: 'fridge', category: 'Produits laitiers', expiresIn: 30, price: 2.5 },
  { name: 'Carottes', amount: 1, unit: 'kg', location: 'fridge', category: 'Légumes', expiresIn: 9, price: 1.3 },
  { name: 'Courgettes', amount: 3, unit: 'pièce', location: 'fridge', category: 'Légumes', expiresIn: 5, price: 1.8 },
  { name: 'Tomates cerises', amount: 250, unit: 'g', location: 'fridge', category: 'Légumes', expiresIn: 4, price: 2.1 },
  { name: 'Pommes', amount: 6, unit: 'pièce', location: 'pantry', category: 'Fruits', expiresIn: 10, price: 2.9 },
  { name: 'Pain de mie', amount: 1, unit: 'pièce', location: 'pantry', category: 'Boulangerie', expiresIn: 6, price: 1.8 },
  { name: 'Pâtes penne', amount: 500, unit: 'g', location: 'pantry', category: 'Épicerie', expiresIn: 240, price: 1.2 },
  { name: 'Riz basmati', amount: 1, unit: 'kg', location: 'pantry', category: 'Épicerie', expiresIn: 365, price: 2.7 },
  { name: 'Coulis de tomate', amount: 500, unit: 'g', location: 'pantry', category: 'Épicerie', expiresIn: 180, price: 1.3 },
  { name: 'Huile d’olive', amount: 1, unit: 'L', location: 'pantry', category: 'Épicerie', expiresIn: null, price: 7.5 },
  { name: 'Épinards surgelés', amount: 1, unit: 'pièce', location: 'freezer', category: 'Surgelés', expiresIn: null, price: 1.6 },
  { name: 'Petits pois surgelés', amount: 1, unit: 'kg', location: 'freezer', category: 'Surgelés', expiresIn: 150, price: 2.2 },
  { name: 'Glace vanille', amount: 1, unit: 'pièce', location: 'freezer', category: 'Surgelés', expiresIn: 90, price: 3.4 },
]

interface HistorySeed {
  name: string
  amount: number
  unit: string
  location: 'fridge' | 'freezer' | 'pantry'
  category: string
  kind: 'consumed' | 'discarded'
  discardReason?: 'expired' | 'spoiled'
  daysAgo: number
  price?: number
}

/** What left the garde-manger over the last weeks — feeds the anti-waste stats. */
// prettier-ignore
const HISTORY: HistorySeed[] = [
  { name: 'Fromage blanc', amount: 1, unit: 'pièce', location: 'fridge', category: 'Produits laitiers', kind: 'consumed', daysAgo: 2, price: 1.7 },
  { name: 'Steaks hachés', amount: 2, unit: 'pièce', location: 'fridge', category: 'Viandes', kind: 'consumed', daysAgo: 3, price: 4.5 },
  { name: 'Bananes', amount: 5, unit: 'pièce', location: 'pantry', category: 'Fruits', kind: 'consumed', daysAgo: 5, price: 1.9 },
  { name: 'Champignons de Paris', amount: 250, unit: 'g', location: 'fridge', category: 'Légumes', kind: 'discarded', discardReason: 'spoiled', daysAgo: 6, price: 1.6 },
  { name: 'Mozzarella', amount: 1, unit: 'pièce', location: 'fridge', category: 'Fromages', kind: 'consumed', daysAgo: 8, price: 1.2 },
  { name: 'Baguette', amount: 1, unit: 'pièce', location: 'pantry', category: 'Boulangerie', kind: 'consumed', daysAgo: 9, price: 1.1 },
  { name: 'Crème dessert chocolat', amount: 4, unit: 'pièce', location: 'fridge', category: 'Produits laitiers', kind: 'discarded', discardReason: 'expired', daysAgo: 12, price: 2.2 },
  { name: 'Poivrons', amount: 3, unit: 'pièce', location: 'fridge', category: 'Légumes', kind: 'consumed', daysAgo: 15, price: 2.4 },
]

// prettier-ignore
const SHOPPING: { name: string; amount: number; unit: string; checked?: boolean }[] = [
  { name: 'Lait demi-écrémé', amount: 2, unit: 'L' },
  { name: 'Bananes', amount: 6, unit: 'pièce' },
  { name: 'Parmesan', amount: 1, unit: 'pièce' },
  { name: 'Café moulu', amount: 250, unit: 'g' },
  { name: 'Liquide vaisselle', amount: 1, unit: 'pièce', checked: true },
]

function clockAt(date: Date): Clock {
  return { now: () => date }
}

/**
 * The account an App Store reviewer signs in with, on the hosted instance.
 *
 * Idempotent: rerunning it resets the password to REVIEW_ACCOUNT_PASSWORD and
 * replaces the household's stock, history and shopping list, with dates
 * computed from today — rerun it right before each submission so "expire
 * bientôt" still means something when the reviewer opens the app.
 */
export default class SeedReviewAccount extends BaseCommand {
  static commandName = 'seed:review-account'
  static description =
    'Create or refresh the App Store review account (REVIEW_ACCOUNT_EMAIL, REVIEW_ACCOUNT_PASSWORD)'
  static options: CommandOptions = { startApp: true }

  async run() {
    const rawEmail = env.get('REVIEW_ACCOUNT_EMAIL', '')
    const password = env.get('REVIEW_ACCOUNT_PASSWORD', '')
    if (!rawEmail || !password) {
      this.logger.error('Set REVIEW_ACCOUNT_EMAIL and REVIEW_ACCOUNT_PASSWORD first.')
      this.exitCode = 1
      return
    }
    if (env.get('DISABLE_PASSWORD_LOGIN', false)) {
      this.logger.error('DISABLE_PASSWORD_LOGIN is set: the reviewer could not sign in by e-mail.')
      this.exitCode = 1
      return
    }
    const email = Email.create(rawEmail)
    if (!email.ok) {
      this.logger.error(`REVIEW_ACCOUNT_EMAIL: ${email.error.message}`)
      this.exitCode = 1
      return
    }

    const userId = await this.upsertUser(email.value, password)
    const householdId = await this.ensureHousehold(userId)
    await this.resetContent(householdId, userId)

    this.logger.success(`Review account ready: ${email.value.value} (household ${householdId})`)
    const exempt = env
      .get('AI_QUOTA_EXEMPT_HOUSEHOLD_IDS', '')
      .split(',')
      .map((id) => id.trim())
    if (!exempt.includes(householdId)) {
      this.logger.warning(
        `Add it to the AI quota exemptions, then restart the API: AI_QUOTA_EXEMPT_HOUSEHOLD_IDS=${householdId}`,
      )
    }
  }

  private async upsertUser(email: Email, password: string): Promise<string> {
    const { auth } = await import('#infrastructure/auth/better-auth/instance')
    const users = await this.app.container.make('identity.userDirectory')

    const existing = await users.findByEmail(email)
    if (!existing) {
      const { user } = await auth.api.signUpEmail({
        body: { email: email.value, password, name: USER_NAME },
      })
      return user.id
    }

    const context = await auth.$context
    if (!(await context.internalAdapter.findCredentialAccount(existing.id))) {
      throw new Error(`${email.value} exists without a password (social sign-in only).`)
    }
    await context.internalAdapter.updatePassword(existing.id, await context.password.hash(password))
    return existing.id
  }

  private async ensureHousehold(userId: string): Promise<string> {
    const households = await this.app.container.make('identity.households')
    const existing = await households.findByUserId(userId)
    if (existing) return existing.id

    const created = await new CreateHousehold(
      households,
      await this.app.container.make('shared.idGenerator'),
      await this.app.container.make('shared.clock'),
    ).execute({ userId, name: HOUSEHOLD_NAME })
    if (!created.ok) throw new Error(`Could not create the household: ${created.error}`)
    return created.value.id
  }

  private async resetContent(householdId: string, userId: string) {
    const products = await this.app.container.make('fridge.products')
    const items = await this.app.container.make('shoppingList.items')
    const ids = await this.app.container.make('shared.idGenerator')
    const clock = await this.app.container.make('shared.clock')
    const now = clock.now()
    const today = new Date(now)
    today.setUTCHours(12, 0, 0, 0)
    const daysFromToday = (days: number) => new Date(today.getTime() + days * DAY)

    await db.transaction(async (trx) => {
      for (const table of ['product_outcome', 'product', 'shopping_item']) {
        await trx.from(table).where('household_id', householdId).delete()
      }
    })

    for (const seed of STOCK) {
      const created = await new CreateProduct(products, ids, clockAt(daysFromToday(-4))).execute({
        householdId,
        name: seed.name,
        quantity: { amount: seed.amount, unit: seed.unit },
        location: seed.location,
        category: seed.category,
        expiresAt: seed.expiresIn === null ? null : daysFromToday(seed.expiresIn),
        openedAt: seed.openedDaysAgo === undefined ? null : daysFromToday(-seed.openedDaysAgo),
        price: seed.price ?? null,
      })
      if (!created.ok) throw new Error(`${seed.name}: ${created.error.message}`)
    }

    for (const seed of HISTORY) {
      const created = await new CreateProduct(
        products,
        ids,
        clockAt(daysFromToday(-seed.daysAgo - 6)),
      ).execute({
        householdId,
        name: seed.name,
        quantity: { amount: seed.amount, unit: seed.unit },
        location: seed.location,
        category: seed.category,
        expiresAt: daysFromToday(-seed.daysAgo + (seed.discardReason === 'expired' ? -1 : 3)),
        price: seed.price ?? null,
      })
      if (!created.ok) throw new Error(`${seed.name}: ${created.error.message}`)

      const recorded = await new RecordProductOutcome(
        products,
        ids,
        clockAt(daysFromToday(-seed.daysAgo)),
      ).execute({
        householdId,
        userId,
        productId: created.value.id,
        kind: seed.kind,
        discardReason: seed.discardReason ?? null,
      })
      if (!recorded.ok) throw new Error(`${seed.name}: ${JSON.stringify(recorded.error)}`)
    }

    const createItem = new CreateShoppingItem(items, ids, clockAt(daysFromToday(-1)))
    for (const seed of SHOPPING) {
      const created = await createItem.execute({
        householdId,
        name: seed.name,
        quantity: { amount: seed.amount, unit: seed.unit },
        source: 'manual',
      })
      if (!created.ok) throw new Error(`${seed.name}: ${created.error.message}`)
      if (seed.checked) {
        created.value.item.toggle(now)
        await items.save(created.value.item)
      }
    }
  }
}
