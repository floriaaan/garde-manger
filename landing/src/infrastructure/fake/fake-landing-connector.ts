import type { LandingConnector } from '../../domain/interfaces/landing-connector.js'
import type { InstanceStats } from '../../domain/instance/instance-stats.js'
import type { ProjectInfo } from '../../domain/project/project-info.js'
import type { Locale } from '../../domain/content/landing-content.js'
import { LANDING_CONTENT } from '../content/landing-content.js'

/** In-memory: no backend, no GitHub. Dev and tests only — its numbers are made up. */
export class FakeLandingConnector implements LandingConnector {
  private readonly subscribed = new Set<string>()

  constructor(
    private readonly stats: InstanceStats | null = {
      households: 128,
      productsConsumed: 9412,
      recipesGenerated: 736,
    },
    private readonly project: ProjectInfo = {
      repository: 'floriaaan/garde-manger',
      url: 'https://github.com/floriaaan/garde-manger',
      stars: 42,
      license: 'MIT',
      latestVersion: null,
    },
  ) {}

  async getContent(locale: Locale) {
    return LANDING_CONTENT[locale]
  }

  async getInstanceStats() {
    return this.stats
  }

  async getProjectInfo() {
    return this.project
  }

  async subscribeToWaitlist(email: string) {
    const normalized = email.trim().toLowerCase()
    const alreadySubscribed = this.subscribed.has(normalized)
    this.subscribed.add(normalized)
    return { alreadySubscribed }
  }
}
