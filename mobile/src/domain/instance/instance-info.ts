export interface InstanceInfo {
  mode: 'hosted' | 'self-hosted'
  name: string | null
  version: string
}

/** Strips a leading "v" so "v1.2.0" and "1.2.0" compare equal. */
function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '')
}

/** Whether a self-hosted server's reported version matches the app's `expo.version`. */
export function isSameVersion(serverVersion: string, appVersion: string): boolean {
  return normalizeVersion(serverVersion) === normalizeVersion(appVersion)
}
