import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AppState, View } from 'react-native'
import { ThemeProvider as NavigationThemeProvider, useSegments, useTheme } from 'expo-router'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { AuthBlobBackground } from './auth-blob-background.js'

const SharedAuthBackground = createContext(false)
export const useSharedAuthBackground = () => useContext(SharedAuthBackground)
const SplashBackground = createContext<(() => () => void) | null>(null)

/** Loading gates outside auth also need the shared ground through their native Stack. */
export function useSplashBackground() {
  const register = useContext(SplashBackground)
  useEffect(() => register?.(), [register])
}

const entryRoutes = new Set(['welcome', 'server-choice', 'reset-password', '(auth)', '(onboarding)', 'join'])

/** Lives above the root Stack: route transitions never replace the animated layer. */
export function AuthBackgroundFrame({ children }: { children: ReactNode }) {
  const palette = useSoftPalette()
  const segments = useSegments()
  const navigationTheme = useTheme()
  const [splashes, setSplashes] = useState(0)
  const registerSplash = useCallback(() => {
    setSplashes((count) => count + 1)
    return () => setSplashes((count) => count - 1)
  }, [])
  const entry = entryRoutes.has(segments[0] ?? '') || splashes > 0
  // NativeStack's ScreenStack container uses theme.colors.background,
  // independently of each screen's transparent contentStyle.
  const theme = entry
    ? { ...navigationTheme, colors: { ...navigationTheme.colors, background: 'transparent' } }
    : navigationTheme
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive')
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'))
    return () => subscription.remove()
  }, [])

  return (
    <SharedAuthBackground.Provider value>
      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: palette.cream }}>
        {/* Keep mounted even outside entry; pausing retains its Animated.Value. */}
        <AuthBlobBackground ground={palette.cream} active={foreground && entry} />
        <SplashBackground.Provider value={registerSplash}>
          <NavigationThemeProvider value={theme}>{children}</NavigationThemeProvider>
        </SplashBackground.Provider>
      </View>
    </SharedAuthBackground.Provider>
  )
}
