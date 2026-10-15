import type { LandingConnector } from '../../domain/interfaces/landing-connector.js'
import type { OperationLogger } from '../../domain/interfaces/operation-logger.js'

/** One completion record per operation; never pass email addresses or response payloads. */
export function withConnectorLogging(connector: LandingConnector, logger: OperationLogger): LandingConnector {
  return {
    getContent: (locale) => logger.run('landing.get_content', () => connector.getContent(locale), { locale }),
    getInstanceStats: () => logger.run('landing.get_instance_stats', () => connector.getInstanceStats()),
    getProjectInfo: () => logger.run('landing.get_project_info', () => connector.getProjectInfo()),
    subscribeToWaitlist: (email) => logger.run('landing.subscribe_to_waitlist', () => connector.subscribeToWaitlist(email)),
  }
}
