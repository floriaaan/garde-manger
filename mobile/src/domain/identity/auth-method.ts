export interface AuthMethod {
  id: 'password' | 'pocketid' | 'google' | 'apple' | 'passkey'
  enabled: boolean
  label: string
  resetAvailable?: boolean
}
