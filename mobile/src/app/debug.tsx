import { Redirect } from 'expo-router'
import { DebugScreen } from '../presentation/debug/debug-screen.js'

/** Dev builds only: a release build must not ship a hidden screen (App Store 2.3.1), even behind a deep link. */
export default function DebugRoute() {
  if (!__DEV__) return <Redirect href="/" />
  return <DebugScreen />
}
