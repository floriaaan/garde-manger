import { withConnectorLogging } from '../src/application/shared/logged-connector.js'
import { operationLogger } from '../src/infrastructure/logging/operation-logger.js'
import { FakeLandingConnector } from '../src/infrastructure/fake/fake-landing-connector.js'
import { HttpLandingConnector } from '../src/infrastructure/http/http-landing-connector.js'
import type { LandingConnector } from '../src/domain/interfaces/landing-connector.js'

/** Wiring lives outside src/ so no layer inside it imports infrastructure directly. */
export function createConnector(): LandingConnector {
  if (import.meta.env.VITE_CONNECTOR !== 'http')
    return withConnectorLogging(new FakeLandingConnector(), operationLogger)
  return withConnectorLogging(
    new HttpLandingConnector({
      apiUrl: (import.meta.env.VITE_API_URL ?? 'https://api-gardemanger.floriaaan.fr').replace(/\/$/, ''),
      githubRepo: import.meta.env.VITE_GITHUB_REPO ?? 'floriaaan/garde-manger',
    }),
    operationLogger,
  )
}
