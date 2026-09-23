import { Platform } from 'react-native'
import { capabilitiesFor } from '../../domain/shared/platform-capabilities.js'

/** Decided once for the running platform — screens read this, never `Platform.OS` (ADR 0019). */
export const platformCapabilities = capabilitiesFor(Platform.OS)
