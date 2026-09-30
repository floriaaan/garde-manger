import { AuthEntryScreen } from '../identity/auth-entry-screen.js'

/** Welcome and sign-up now share one useful screen. */
export function WelcomeScreen() {
  return <AuthEntryScreen initialMode="sign-up" />
}
