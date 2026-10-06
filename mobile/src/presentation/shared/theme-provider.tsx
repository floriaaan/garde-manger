import { useEffect } from 'react'
import { useColorScheme } from 'react-native'
import { TamaguiProvider } from 'tamagui'
import type { ReactNode } from 'react'
import { tamaguiConfig } from '../../../tamagui.config'
import { installWebSurfaces } from './web-surfaces.js'
import { paletteFor } from '../dashboard/soft-palette.js'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme()
  const palette = paletteFor(colorScheme)
  // Focus rings and text selection are CSS state selectors, which a React
  // Native style object cannot express — so the web build gets them injected
  // once from the same palette every component draws from.
  useEffect(() => {
    installWebSurfaces(palette.accentLime, palette.accentLimeText, palette.ink)
  }, [palette.accentLime, palette.accentLimeText, palette.ink])
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      {children}
    </TamaguiProvider>
  )
}
