/** Keep the existing RP ID unless the operator explicitly migrates credentials. */
export function buildPasskeyOptions(input: {
  networkUrl: string
  rpID: string
  webOrigins: string
  androidFingerprint: string
}) {
  const api = new URL(input.networkUrl)
  const rpID = input.rpID.trim().toLowerCase() || api.hostname
  if (!/^[a-z0-9.-]+$/i.test(rpID) || rpID.startsWith('.') || rpID.endsWith('.')) {
    throw new Error('PASSKEY_RP_ID must be a hostname without a scheme or port')
  }
  const origin = [api.origin]
  for (const value of input.webOrigins
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const url = new URL(value)
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) ||
      url.origin !== value ||
      (url.hostname !== rpID && !url.hostname.endsWith(`.${rpID}`))
    ) {
      throw new Error('PASSKEY_WEB_ORIGINS must contain origins on the RP ID or its subdomains')
    }
    origin.push(url.origin)
  }
  const fingerprint = input.androidFingerprint.replaceAll(':', '')
  if (input.androidFingerprint) {
    if (!/^(?:[0-9a-fA-F]{2}:){31}[0-9a-fA-F]{2}$/.test(input.androidFingerprint)) {
      throw new Error(
        'ANDROID_APP_SIGNING_SHA256 must be a colon-separated SHA-256 certificate fingerprint',
      )
    }
    origin.push(`android:apk-key-hash:${Buffer.from(fingerprint, 'hex').toString('base64url')}`)
  }
  return { rpID, origin: [...new Set(origin)] }
}
