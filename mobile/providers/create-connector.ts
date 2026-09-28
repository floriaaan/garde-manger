import { HttpFridgeConnector } from '../src/infrastructure/http/http-fridge-connector.js'
import { FakeFridgeConnector } from '../src/infrastructure/fake/fake-fridge-connector.js'
import type { FridgeConnector } from '../src/domain/interfaces/fridge-connector.js'
import { isFakeConnector } from '../src/application/shared/connector-mode.js'

export function createConnector(): FridgeConnector {
  return isFakeConnector ? new FakeFridgeConnector() : new HttpFridgeConnector()
}
