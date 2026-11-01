import * as IAP from 'expo-iap'
import { applePurchases } from './apple-purchases.ios.js'

jest.mock('expo-iap', () => ({ fetchProducts: jest.fn() }))

const monthly = {
  id: 'com.floriaaan.gardemanger.ai.monthly', title: 'IA du foyer', displayPrice: '1,49 €',
  subscriptionPeriodUnitIOS: 'month', subscriptionPeriodNumberIOS: '1',
}

test('loads the StoreKit monthly product and its localized price', async () => {
  ;(IAP.fetchProducts as jest.Mock).mockResolvedValue([monthly])
  await expect(applePurchases.product(monthly.id)).resolves.toEqual({
    id: monthly.id, title: monthly.title, displayPrice: monthly.displayPrice,
  })
  expect(IAP.fetchProducts).toHaveBeenCalledWith({ skus: [monthly.id], type: 'subs' })
})

test.each([
  [[], 'apple_product_not_found'],
  [[{ ...monthly, subscriptionPeriodNumberIOS: '12' }], 'apple_product_invalid_period'],
])('classifies unavailable and incompatible products without exposing receipts', async (products, code) => {
  ;(IAP.fetchProducts as jest.Mock).mockResolvedValue(products)
  await expect(applePurchases.product(monthly.id)).rejects.toMatchObject({ code })
})
