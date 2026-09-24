import type { LandingContent, Locale } from '../content/landing-content.js'
import type { InstanceStats } from '../instance/instance-stats.js'
import type { ProjectInfo } from '../project/project-info.js'

/** Every external interaction the landing page makes goes through this port. */
export interface LandingConnector {
  getContent(locale: Locale): Promise<LandingContent>
  /** `null` when the instance has not opted in to public stats (backend 404). */
  getInstanceStats(): Promise<InstanceStats | null>
  getProjectInfo(): Promise<ProjectInfo>
  /** Throws on an invalid email. `alreadySubscribed` lets the UI hint at a repeat signup without treating it as an error. */
  subscribeToWaitlist(email: string): Promise<{ alreadySubscribed: boolean }>
}
