import '../presentation/shared/fonts.css'
import { watchSystemLanguage } from '../i18n/index.js'
import { Stack, router } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useShareIntent } from 'expo-share-intent'
import { AuthBackgroundFrame } from '../presentation/identity/auth-background-frame.js'
import { ConfettiHost } from '../presentation/shared/confetti.js'
import { ThemeProvider } from '../presentation/shared/theme-provider.js'
import { ToastHost } from '../presentation/shared/toast.js'
import { ErrorBoundary } from '../presentation/shared/error-boundary.js'
import { ConnectorProvider } from '../application/shared/connector-context.js'
import { queryClient } from '../application/shared/query-client.js'
import { createConnector } from '../../providers/create-connector.js'
import { startTelemetry } from '../../providers/start-telemetry.js'
import { wireTelemetry } from '../../providers/wire-telemetry.js'
import { wireFocusManager } from '../application/shared/wire-focus-manager.js'
import { loadStoredServerUrl } from '../application/shared/server-config.js'

// Module load, not an effect: this only assigns a reference (see
// `wire-telemetry.ts`) — nothing to defer past the first frame, and every
// `getTelemetry()` call under `src/presentation` needs it wired before the
// first screen can possibly report a failure.
wireTelemetry()

export default function RootLayout() {
  useEffect(() => watchSystemLanguage(), [])
  // Module-level singleton, not `useState(() => new QueryClient())` — see
  // `query-client.ts`: `http-client.ts` needs the same instance to flip the
  // cached session on a 401, and a client built inside this component would
  // be unreachable from a plain module.
  const [connector] = useState(() => createConnector())

  // In an effect, not at module load: telemetry must never sit on the path
  // to the first frame. `start()` is a no-op unless
  // EXPO_PUBLIC_TELEMETRY_ENABLED is "true", and it opens no connection —
  // the first export happens 15s later, batched.
  useEffect(() => startTelemetry(), [])

  // Session restoration must also retry on foreground before tabs mount.
  useEffect(() => wireFocusManager(), [])

  // The SPA's manifest lets iOS offer Web Push when installed on the home screen.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = '/manifest.webmanifest'
    document.head.appendChild(link)
    return () => link.remove()
  }, [])

  // Blocks the first render on the chosen server URL (SecureStore, falling
  // back to EXPO_PUBLIC_API_URL) — auth-client and http-client both read it
  // lazily, but a session check fired before this resolves would still race
  // against the default URL on a device that chose a different server.
  const [serverReady, setServerReady] = useState(false)
  useEffect(() => {
    loadStoredServerUrl().then(() => setServerReady(true))
  }, [])

  // A PDF shared into the app from another app (Mail, Files…) lands here as
  // a share intent, not a route param — the only route the receipt review
  // screen already knows how to read is `imageUri`, so this just forwards
  // the shared file's local path into the same flow a camera capture uses.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent()
  useEffect(() => {
    if (!serverReady || !hasShareIntent) return
    const file = shareIntent.files?.find((f) => f.mimeType === 'application/pdf')
    if (file) router.push({ pathname: '/receipts/review', params: { imageUri: file.path } })
    resetShareIntent()
  }, [serverReady, hasShareIntent, shareIntent, resetShareIntent])

  if (!serverReady) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ConnectorProvider connector={connector}>
            <ErrorBoundary>
              {/* A Stack, not a Slot. `Réglages`, `Foyer` and `Historique des
                tickets` used to live inside `(tabs)/`, where iOS's
                `NativeTabs` only routes to the five declared triggers — so
                `router.push('/settings')` was a silent no-op on iOS and the
                only entrance to settings was dead. They are pushed screens,
                never tabs (`AppShell`'s `{ kind: 'stack' }`), so they now sit
                here as siblings of the tab group, which needs a real stack
                navigator at the root to push onto. URLs are unchanged: `(tabs)`
                is a group, so `/settings` was already `/settings`. */}
              <AuthBackgroundFrame>
                <Stack screenOptions={{ headerShown: false }}>
                  {/* First-time entry shares the auth screen in registration mode. */}
                  <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
                  <Stack.Screen name="server-choice" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
                  <Stack.Screen name="reset-password" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
                  <Stack.Screen name="(auth)" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
                  {/* Between `(auth)` and `(tabs)`, and a sibling of both: an
                    account with no foyer is signed in but has no screen inside
                    the tabs that could honestly render, so it gets its own
                    group with its own gate. `join` is the deep-link landing
                    route for `gardemanger://join?code=…`. */}
                  <Stack.Screen name="(onboarding)" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
                  <Stack.Screen name="join" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
                  <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="pantry-checkup" />
                  <Stack.Screen name="expiry-reminders" />
                  <Stack.Screen name="account" />
                  <Stack.Screen name="delete-account" />
                  <Stack.Screen name="household" />
                  <Stack.Screen name="receipts" />
                  <Stack.Screen name="tasks" />
                  <Stack.Screen name="action-sheet" options={{
                    presentation: 'formSheet', sheetAllowedDetents: 'fitToContents',
                    sheetGrabberVisible: true, sheetExpandsWhenScrolledToEdge: true,
                    gestureEnabled: true,
                  }} />
                  <Stack.Screen name="scanner" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="home-assistant" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="debug" options={{ presentation: 'modal' }} />
                </Stack>
              </AuthBackgroundFrame>
            </ErrorBoundary>
          </ConnectorProvider>
        </QueryClientProvider>
        <ToastHost />
        <ConfettiHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
