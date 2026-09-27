import { Redirect } from 'expo-router'

/** Keep old sign-up links working; both modes now live on one screen. */
export default function SignUpRedirect() {
  return <Redirect href={{ pathname: '/(auth)/sign-in', params: { mode: 'sign-up' } }} />
}
