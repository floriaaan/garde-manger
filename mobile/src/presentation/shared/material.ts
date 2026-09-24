/*
 * Material 3 for Android, expressed through this system's own palette.
 *
 * The audit's blocking question was: does Android get Material, or does one
 * visual world ship to both platforms? Answer (asked for directly,
 * 2026-09-06): Material 3 — but Material is a *rulebook*, not a skin, and
 * `android.md` says so in as many words: "brand expresses through Material's
 * theming (color roles, type scale, shape, motion)". So the palette does not
 * change. What changes on Android is the grammar around it:
 *
 * — **Color roles.** Every Material surface asks for a role (`surface`,
 *   `surfaceContainer`, `secondaryContainer`, `inverseSurface`…), not a hex.
 *   The map below is the one place this system answers those questions, so a
 *   Material component can be built without inventing a colour.
 * — **Tonal elevation, not drop shadows.** M3 raises a surface by tinting it
 *   toward the primary, not by casting a shadow under it. `tonal()` returns
 *   the fill for a level; `androidElevation()` returns the (much lighter)
 *   shadow that goes with it.
 * — **Ripple, not scale.** The spring-scale press is an iOS/web idiom. On
 *   Android a touch produces a ripple bounded by the control. `ripple()`
 *   builds the `android_ripple` config; `useHoverPress` already skips its
 *   scale on Android because of this.
 * — **Material motion.** Standard/emphasized easing and the M3 duration
 *   tokens, so a transition on Android feels like the platform's.
 *
 * iOS and web read none of this: they keep the HIG-shaped chrome the app
 * already had (`NativeTabs`, the floating glass pill, spring scale).
 */
import { Easing, Platform } from 'react-native'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export const IS_ANDROID = Platform.OS === 'android'

/**
 * The Material 3 color roles this app actually uses, resolved from the
 * committed palette. Named for the role, never for the colour — that is the
 * whole point of the indirection, and it is what lets the dark scheme follow
 * without a second table.
 */
export interface MaterialRoles {
  primary: string
  onPrimary: string
  /** The active navigation-bar indicator, and any "selected" pill. */
  secondaryContainer: string
  onSecondaryContainer: string
  surface: string
  onSurface: string
  onSurfaceVariant: string
  /** The navigation bar's own ground — M3 level-2 container, a step off `surface`. */
  surfaceContainer: string
  surfaceContainerHigh: string
  /** Snackbars and any surface that must invert to read as transient. */
  inverseSurface: string
  inverseOnSurface: string
  error: string
  errorContainer: string
  onErrorContainer: string
  outlineVariant: string
}

export function materialRoles(palette: SoftPalette): MaterialRoles {
  return {
    primary: palette.accentLime,
    onPrimary: palette.accentLimeText,
    secondaryContainer: palette.accentLime,
    onSecondaryContainer: palette.accentLimeText,
    surface: palette.gradientBottom,
    onSurface: palette.ink,
    onSurfaceVariant: palette.inkSecondary,
    surfaceContainer: palette.layoutSurface,
    surfaceContainerHigh: palette.cream,
    inverseSurface: palette.brandDeep,
    inverseOnSurface: palette.brandDeepText,
    error: palette.expired,
    errorContainer: palette.expiredBg,
    onErrorContainer: palette.expiredText,
    outlineVariant: palette.mintPale,
  }
}

/**
 * M3 elevation levels 0-5 as the *shadow* half only. Android's own tonal
 * tinting is applied by picking the right `surfaceContainer*` role for the
 * fill; these numbers are the `elevation` prop that goes with it. They are
 * deliberately far lower than this system's iOS shadows: a Material surface
 * that casts an iOS-sized shadow reads as a sticker.
 */
export const MATERIAL_ELEVATION = [0, 1, 3, 6, 8, 12] as const
export type MaterialElevationLevel = 0 | 1 | 2 | 3 | 4 | 5

/**
 * The shadow half of a surface, per platform. On Android this is a Material
 * elevation number; everywhere else it is the system's own wide, soft,
 * low-opacity shadow, which the DESIGN.md brief pins as an invariant.
 */
export function surfaceShadow(
  palette: SoftPalette,
  level: MaterialElevationLevel,
  ios: { offsetY: number; opacity: number; radius: number; color?: string },
) {
  if (IS_ANDROID) return { elevation: MATERIAL_ELEVATION[level] }
  return {
    shadowColor: ios.color ?? palette.shadowCool,
    shadowOffset: { width: 0, height: ios.offsetY },
    shadowOpacity: ios.opacity,
    shadowRadius: ios.radius,
    elevation: MATERIAL_ELEVATION[level],
  }
}

/**
 * `android_ripple` config, or `undefined` off Android so a Pressable prop can
 * be spread unconditionally. `borderless` is for icon-only controls, where
 * Material lets the ripple escape the bounds as a circle.
 */
export function ripple(color: string, options?: { borderless?: boolean; radius?: number }) {
  if (!IS_ANDROID) return undefined
  return { color, borderless: options?.borderless ?? false, radius: options?.radius, foreground: true }
}

/** Material 3 motion: duration tokens (ms) and the two easings this app needs. */
export const MATERIAL_MOTION = {
  short: 200,
  medium: 400,
  long: 500,
  /** M3 "standard" — most transitions. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** M3 "emphasized decelerate" — something entering the screen. */
  decelerate: Easing.bezier(0.05, 0.7, 0.1, 1),
} as const

/**
 * The platform's own transition curve and duration for an entrance. iOS keeps
 * this system's exponential ease-out; Android gets M3 emphasized decelerate.
 */
export function entranceMotion() {
  return IS_ANDROID
    ? { duration: MATERIAL_MOTION.medium, easing: MATERIAL_MOTION.decelerate }
    : { duration: 320, easing: Easing.out(Easing.cubic) }
}

/**
 * Clips a bounded `android_ripple` to the rounded shape its control actually
 * draws. Every control here puts its `borderRadius` on a child (the animated
 * scale wrapper's content), leaving the `Pressable` itself a square box — and
 * Android paints a bounded ripple against *that* box, so the ripple squared
 * off the corners of every pill, chip and card. Spread into the `Pressable`'s
 * own style with the same radius the child uses; a no-op off Android, and not
 * needed for `borderless` ripples, which are meant to escape their bounds.
 */
export function rippleClip(radius: number | Record<string, number>) {
  if (!IS_ANDROID) return undefined
  const corners = typeof radius === 'number' ? { borderRadius: radius } : radius
  return { ...corners, overflow: 'hidden' as const }
}
