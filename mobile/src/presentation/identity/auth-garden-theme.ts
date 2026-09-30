import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/** Scoped to entry screens: the chosen Gardens composition, not a global rebrand. */
export function gardenColors(palette: SoftPalette) {
  return {
    ground: palette.cream,
    leaf: palette.blobStrong,
    leafInk: palette.ink,
    ink: palette.ink,
    muted: palette.inkSecondary,
    action: palette.accentLime,
    actionInk: palette.accentLimeText,
  }
}

export const AuthGardenContext = createContext<ReturnType<typeof gardenColors> | null>(null)
export const useAuthGarden = () => useContext(AuthGardenContext)

export const AuthEntryLayoutContext = createContext<{ keyboardOpen: boolean; heroSpace: number | null; availableHeight: number }>({ keyboardOpen: false, heroSpace: null, availableHeight: 0 })
export const useAuthEntryLayout = () => useContext(AuthEntryLayoutContext)

/** Give the keyboard the space used by entry chrome, keeping the actual form mounted. */
export function AuthKeyboardAccessory({ children }: { children: ReactNode }) {
  return useAuthEntryLayout().keyboardOpen ? null : children
}
