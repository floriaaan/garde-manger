/**
 * The lime FAB means one thing everywhere: "scan something into the foyer" —
 * it opens the Scanner, which is the one screen that offers every scan
 * destination (produit, ticket, frigo), as a sheet over wherever the cook is.
 * iPhone's floating tab still lands on its own copy at `(tabs)/scan`. It used to open an action sheet with
 * two of those three choices baked in here a second time; adding "Mon frigo"
 * would have made it three places to keep in sync. One destination, one place.
 */
import { router } from 'expo-router'

export function goToScan() {
  router.push('/scanner')
}

/** `.navigate`, not `.push`: on iOS, NativeBottomTabsRouter only special-cases
 * NAVIGATE to jump into another tab's nested stack with params. */

export function goToProductScan() {
  router.navigate({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })
}

export function goToReceiptScan() {
  router.navigate('/receipts/scan')
}
