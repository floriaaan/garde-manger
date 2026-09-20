import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class HouseholdSubscriptionModel extends BaseModel {
  static table = 'household_subscription'

  @column({ isPrimary: true, columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'payer_user_id' })
  declare payerUserId: string | null

  @column({ columnName: 'stripe_customer_id' })
  declare stripeCustomerId: string | null

  @column({ columnName: 'stripe_subscription_id' })
  declare stripeSubscriptionId: string | null

  @column({ columnName: 'cancel_at_period_end' })
  declare cancelAtPeriodEnd: boolean

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
