import { AggregateRoot } from '#domain/shared/aggregate-root'
import { Quantity } from './quantity.vo.js'
import type { Location } from './location.vo.js'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

interface ProductProps {
  householdId: string
  receiptId: string | null
  name: string
  quantity: Quantity
  /** The largest quantity this product is known to have had — what `price` pays for (ADR-0012). */
  initialQuantity: number
  location: Location
  expiresAt: Date | null
  openedAt: Date | null
  category: string
  openfoodfactId: string | null
  categories: string[] | null
  price: number | null
  imageKey: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateProductProps {
  id: string
  householdId: string
  name: string
  quantity: Quantity
  location: Location
  category: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  receiptId?: string | null
  price?: number | null
  imageKey?: string | null
  createdAt: Date
}

export interface UpdateProductProps {
  name?: string
  quantity?: Quantity
  location?: Location
  category?: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
  imageKey?: string | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface TakeOut {
  /** The product still in the garde-manger, or `null` when the whole stock left. */
  remaining: Product | null
  /** The part that left — the quantity an outcome records. */
  taken: Quantity
  /** `price` prorated to `taken` over `initialQuantity`, to the cent. */
  price: number | null
}

/**
 * PATCH persists the monotonically advancing `updatedAt` through an atomic
 * conditional update. It is also the mobile queue's optimistic concurrency token.
 */
export class Product extends AggregateRoot<string> {
  private props: ProductProps

  private constructor(id: string, props: ProductProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateProductProps): Product {
    return new Product(params.id, {
      householdId: params.householdId,
      receiptId: params.receiptId ?? null,
      name: params.name,
      quantity: params.quantity,
      initialQuantity: params.quantity.amount,
      location: params.location,
      expiresAt: params.expiresAt ?? null,
      openedAt: params.openedAt ?? null,
      category: params.category,
      openfoodfactId: params.openfoodfactId ?? null,
      categories: params.categories ?? null,
      price: params.price ?? null,
      imageKey: params.imageKey ?? null,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: ProductProps): Product {
    return new Product(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get receiptId(): string | null {
    return this.props.receiptId
  }

  get name(): string {
    return this.props.name
  }

  get quantity(): Quantity {
    return this.props.quantity
  }

  get initialQuantity(): number {
    return this.props.initialQuantity
  }

  get location(): Location {
    return this.props.location
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt
  }

  get openedAt(): Date | null {
    return this.props.openedAt
  }

  get category(): string {
    return this.props.category
  }

  get openfoodfactId(): string | null {
    return this.props.openfoodfactId
  }

  get categories(): string[] | null {
    return this.props.categories
  }

  get price(): number | null {
    return this.props.price
  }

  get imageKey(): string | null {
    return this.props.imageKey
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  /**
   * `patch` must only include keys the caller actually wants to change —
   * never pass `undefined` for "leave as is", omit the key instead (object
   * spread does not treat an explicit `undefined` as "absent").
   */
  update(patch: UpdateProductProps, updatedAt: Date): void {
    const initialQuantity = Math.max(this.props.initialQuantity, patch.quantity?.amount ?? 0)
    this.props = { ...this.props, ...patch, initialQuantity, updatedAt }
  }

  /**
   * Some or all of the stock leaves the garde-manger.
   *
   * The whole stock returns `remaining: null` and leaves this instance as it
   * was — the repository deletes the row. Part of it decrements in place.
   * Either way the caller gets the part that left and what it was worth, which
   * is everything an outcome needs that the product will no longer say.
   */
  takeOut(amount: number, at: Date): ResultType<TakeOut, ValidationError> {
    const current = this.props.quantity
    if (!Number.isInteger(amount) || amount <= 0 || amount > current.amount) {
      return Result.err({
        field: 'quantity',
        message: `La quantité sortie doit être un entier entre 1 et ${current.amount}.`,
      })
    }

    const taken = Quantity.create(amount, current.unit)
    if (!taken.ok) return taken

    const price =
      this.props.price === null
        ? null
        : Math.round(((this.props.price * amount) / this.props.initialQuantity) * 100) / 100

    if (amount === current.amount) return Result.ok({ remaining: null, taken: taken.value, price })

    const left = Quantity.create(current.amount - amount, current.unit)
    if (!left.ok) return left
    this.props = { ...this.props, quantity: left.value, updatedAt: at }
    return Result.ok({ remaining: this, taken: taken.value, price })
  }

  isExpiringSoon(withinDays: number, now: Date): boolean {
    if (!this.props.expiresAt) return false
    const threshold = new Date(now.getTime() + withinDays * MS_PER_DAY)
    return this.props.expiresAt >= now && this.props.expiresAt <= threshold
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt !== null && this.props.expiresAt < now
  }
}
