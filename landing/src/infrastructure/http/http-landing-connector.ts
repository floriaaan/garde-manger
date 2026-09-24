import type { LandingConnector } from '../../domain/interfaces/landing-connector.js'
import type { InstanceStats } from '../../domain/instance/instance-stats.js'
import type { ProjectInfo } from '../../domain/project/project-info.js'
import type { Locale } from '../../domain/content/landing-content.js'
import { LANDING_CONTENT } from '../content/landing-content.js'
import { subscribeToWaitlistServerFn } from '../waitlist/subscribe-to-waitlist.js'

export interface HttpLandingConnectorConfig {
  /** Backend base URL, without trailing slash. */
  apiUrl: string
  /** `owner/name`. */
  githubRepo: string
  fetch?: typeof fetch
}

export class HttpLandingConnector implements LandingConnector {
  private readonly fetch: typeof fetch

  constructor(private readonly config: HttpLandingConnectorConfig) {
    this.fetch = config.fetch ?? ((...args) => globalThis.fetch(...args))
  }

  async getContent(locale: Locale) {
    return LANDING_CONTENT[locale]
  }

  async getInstanceStats(): Promise<InstanceStats | null> {
    const response = await this.fetch(`${this.config.apiUrl}/api/public/stats`)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`GET /api/public/stats failed: ${response.status}`)
    const body = (await response.json()) as { stats: InstanceStats }
    return body.stats
  }

  async getProjectInfo(): Promise<ProjectInfo> {
    const base = `https://api.github.com/repos/${this.config.githubRepo}`
    const headers = { Accept: 'application/vnd.github+json' }
    const [repoResponse, releaseResponse] = await Promise.all([
      this.fetch(base, { headers }),
      this.fetch(`${base}/releases/latest`, { headers }),
    ])
    if (!repoResponse.ok) throw new Error(`GitHub repo lookup failed: ${repoResponse.status}`)

    const repo = (await repoResponse.json()) as {
      full_name: string
      html_url: string
      stargazers_count: number
      license: { spdx_id: string } | null
    }
    // 404 = no release published yet, which is a state, not a failure.
    const release = releaseResponse.ok
      ? ((await releaseResponse.json()) as { tag_name: string })
      : null

    return {
      repository: repo.full_name,
      url: repo.html_url,
      stars: repo.stargazers_count,
      license: repo.license?.spdx_id ?? null,
      latestVersion: release?.tag_name ?? null,
    }
  }

  async subscribeToWaitlist(email: string) {
    return subscribeToWaitlistServerFn({ data: email })
  }
}
