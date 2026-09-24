/**
 * Every screen's title block, in one place.
 *
 * Six screens each hand-rolled this — a `BackButton` maybe, a 20/800 title,
 * a 13/500 count line under it, and a trailing action pill — and none of them
 * carried an icon, so a screen announced itself with a word alone. That is
 * fine on the one screen you are looking at and poor across a stack of them:
 * a glyph is what makes "Garde-manger", "Recettes" and "Historique des tickets"
 * distinguishable at a glance and while scrolling, and it is the same glyph
 * the tab bar and the sidebar already use for that section.
 *
 * The icon sits in its own 38pt tinted square rather than inline with the
 * text: at title size an inline glyph either looks undersized against 20/800
 * or fights it, and the square gives the header the same "chip + label"
 * rhythm the StatCards and the settings rows already have.
 */
import type { ReactNode } from 'react'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { BackButton } from './back-button.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function ScreenHeader({
  palette,
  icon,
  title,
  subtitle,
  onBack,
  trailing,
  tint,
}: {
  palette: SoftPalette
  icon: (color: string) => ReactNode
  title: string
  /** The count/status line under the title — omit it rather than filling it with a placeholder. */
  subtitle?: string
  /** Pushed screens only; tab screens have the bottom nav instead. */
  onBack?: () => void
  /** A single action pill on the trailing edge ("Ajouter"). */
  trailing?: ReactNode
  /** Overrides the icon square's fill — the fridge uses its cabinet enamel so the header reads as part of the appliance. */
  tint?: string
}) {
  return (
    // minHeight 44: the row's height must not depend on what is *in* it.
    // Without it, a header carrying a trailing "Ajouter" pill (44pt) stood
    // taller than one without (the title+subtitle block alone is ~42pt), so
    // Garde-manger and Courses sat a couple of points lower than Recettes and
    // the title jumped as you moved between tabs. 44 is also the touch-target
    // floor every control in the row already respects.
    <XStack alignItems="center" gap="$3" minHeight={44}>
      {onBack ? <BackButton onPress={onBack} ink={palette.ink} cream={palette.cream} /> : null}
      <XStack alignItems="center" gap="$2.5" flex={1}>
        <YStack
          width={38}
          height={38}
          borderRadius={13}
          backgroundColor={tint ?? palette.cream}
          alignItems="center"
          justifyContent="center"
        >
          {icon(palette.ink)}
        </YStack>
        <YStack flex={1}>
          {/* The screen's name is a heading, and a screen reader's rotor is
              how a non-visual user finds their place on a long list. */}
          <Text fontSize={20} fontWeight="800" color={palette.ink} numberOfLines={1} role="heading">
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      {trailing}
    </XStack>
  )
}
