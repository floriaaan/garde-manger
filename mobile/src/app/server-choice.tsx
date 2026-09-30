import { router, useLocalSearchParams } from 'expo-router'
import { ServerChoiceScreen } from '../presentation/onboarding/server-choice-screen.js'

export default function ServerChoiceRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>()
  function returnToAuth() {
    if (router.canGoBack()) router.back()
    else router.replace({ pathname: '/(auth)/sign-in', params: { mode: next === 'sign-in' ? 'sign-in' : 'sign-up' } })
  }
  return <ServerChoiceScreen onDone={returnToAuth} onBack={returnToAuth} />
}
