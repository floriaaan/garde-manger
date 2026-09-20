import { FakeLandingConnector } from '../src/infrastructure/fake/fake-landing-connector.js'
import { HttpLandingConnector } from '../src/infrastructure/http/http-landing-connector.js'
import type { LandingConnector } from '../src/domain/interfaces/landing-connector.js'

/** Wiring lives outside src/ so no layer inside it imports infrastructure directly. */
export function createConnector(): LandingConnector {
  if (import.meta.env.VITE_CONNECTOR !== 'http') return new FakeLandingConnector()
  return new HttpLandingConnector({
    apiUrl: (import.meta.env.VITE_API_URL ?? 'http://localhost:3333').replace(/\/$/, ''),
    githubRepo: import.meta.env.VITE_GITHUB_REPO ?? 'floriaaan/garde-manger',
  })
}
