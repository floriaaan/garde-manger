import { Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { ReactNode } from 'react'
import { surfaceShadow } from './material.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * The floating pill shape+position shared by every top toast in the app —
 * `ToastHost` (network/transport failures) and `HintBubble`'s iOS/web
 * branch (per-screen action feedback: "Ajouté", "Erreur", "bientôt
 * disponible"). One place for the numbers so the two can't quietly drift
 * apart the way `HintBubble`'s bottom card and this pill once did.
 *
 * Android is deliberately untouched by any of this — it keeps its own
 * Material 3 Snackbar (see `HintBubble`), a different platform convention
 * this pill doesn't attempt to unify with.
 */

/** The pill surface itself — spread alongside a `backgroundColor` and `toastPillShadow`. */
export const TOAST_PILL_STYLE = {
  borderRadius: 14,
  paddingVertical: 10,
  paddingHorizontal: 16,
  maxWidth: 480,
}

export function toastPillShadow(palette: SoftPalette) {
  return surfaceShadow(palette, 3, { offsetY: 4, opacity: 0.15, radius: 10 })
}

/**
 * Positions a toast pill at the top, clear of the notch/status bar, and
 * drives the shared slide-down-while-fading-in entrance. `SafeAreaView`,
 * not `useSafeAreaInsets()`: the hook throws outside a `SafeAreaProvider`
 * ancestor, which most of the screens `HintBubble` renders inside of are
 * unit-tested without (cf. `action-sheet.tsx`'s own note on the same
 * constraint) — `SafeAreaView` falls back to a zero inset instead, so this
 * is safe to mount anywhere either toast already renders today.
 */
export function ToastPillLayer({
  progress,
  pointerEvents,
  fullWidth = false,
  children,
}: {
  progress: Animated.Value
  /** `"box-none"` when the pill itself is pressable (`ToastHost`'s dismiss tap); `"none"` for a purely informational toast (`HintBubble`) that must never block the screen under it. */
  pointerEvents: 'box-none' | 'none'
  /** Stretch the pill across the screen instead of shrink-wrapping it — for a hint with a description or an action. */
  fullWidth?: boolean
  children: ReactNode
}) {
  return (
    <SafeAreaView
      edges={['top']}
      pointerEvents={pointerEvents}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: 0,
        alignItems: fullWidth ? 'stretch' : 'center',
        zIndex: 1000,
      }}
    >
      <Animated.View
        pointerEvents={pointerEvents}
        style={{
          marginTop: 8,
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        }}
      >
        {children}
      </Animated.View>
    </SafeAreaView>
  )
}
