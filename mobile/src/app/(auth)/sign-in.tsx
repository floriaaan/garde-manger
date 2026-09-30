import { useLocalSearchParams } from 'expo-router'
import { AuthEntryScreen } from '../../presentation/identity/auth-entry-screen.js'

export default function SignInScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  return <AuthEntryScreen initialMode={mode === 'sign-up' ? 'sign-up' : 'sign-in'} />
}
