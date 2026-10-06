import { t } from '../../i18n/index.js'
import type { HouseholdRole } from '../../domain/identity/household.js'

/** One localized label per household role, shared by the Foyer screen and the Réglages foyer card. */
export const ROLE_LABELS: Record<HouseholdRole, string> = { get owner() { return t('identity.owner') }, get member() { return t('identity.member') } }
