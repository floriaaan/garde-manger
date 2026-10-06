import { useTranslation } from '../../i18n/index.js'
/*
 * DIRECTION CONTRACT — the Frigo screen's cabinet (2026-09-05, asked for
 * directly: "peux-tu rendre la page frigo skeumorphique — que ça ressemble
 * davantage à un vrai frigo", answered as real shelves grouped by
 * compartment rather than a decorated flat list).
 *
 * Same world, same shell, same tokens for everything outside the cabinet.
 * The cabinet itself is a disclosed, screen-scoped exception, built the way
 * the shopping list's legal pad already is — three real material cues,
 * executed with restraint, never a pile of textures:
 *
 * — A COLD surface in a warm system. Every other screen is mint/cream/mocha;
 *   the cabinet is cool enamel. That inversion is the whole effect: an
 *   appliance reads as an appliance because it is the one cold thing in a
 *   sunlit pantry. The two never share a screen, so the warm identity is
 *   never diluted — see `cabinet*` in soft-palette.ts.
 * — A lit interior. The liner is a step LIGHTER than the body that frames it,
 *   with one cold light wash falling from the top edge. A fridge you have
 *   opened is lit from inside; a flat cool rectangle is just a grey card.
 * — Real shelves. Each compartment's products sit on a glass plate, and the
 *   plate's front lip catches the light below them. The lip is a filled bar,
 *   not a stroke, so DESIGN.md's "no borders" rule still holds inside the
 *   exception (the same way the shopping list's tear-line is a fill, not a
 *   border).
 *
 * What the exception does NOT get:
 * — no chrome handle, no magnets, no photographic texture, no drawn ice. The
 *   guardrail is the same one the notepad got: commit to the material, not to
 *   a costume version of it.
 * — no rounded top. A door seal runs along a straight edge, so the cabinet's
 *   top corners are nearly square and only the bottom pair rounds — and
 *   asymmetrically between them, so the No-Uniform-Radius rule still holds.
 *
 * One real trade-off, recorded rather than hidden: the flat list was sorted
 * globally by expiry ("le plus urgent en premier"), and shelves break that
 * ordering across compartments — a shelf is a physical place and cannot
 * reorder itself. Sorting is preserved *within* every shelf, the status pills
 * still carry urgency, and the dashboard keeps the global "what expires next"
 * answer in its hero and its "À consommer en premier" list. The fridge screen's
 * question is "what do we have, and where".
 */
import type { ReactNode } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * The cabinet: enamel body, a door seal along the top edge, and a lit liner
 * that the caller's own scroll container fills. The list scrolls *inside* the
 * frame rather than the frame scrolling away, which is both the honest
 * metaphor (you look into a fridge; the shelves stay put) and what keeps the
 * screen's `FlatList`/`SectionList` virtualization intact.
 */
export function FridgeCabinet({ palette, children }: { palette: SoftPalette; children: ReactNode }) {
  return (
    <YStack
      flex={1}
      minHeight={0}
      backgroundColor={palette.cabinetEnamel}
      padding={6}
      overflow="hidden"
      style={{
        // Nearly square at the top (the seal runs along a straight edge),
        // rounded and asymmetric at the bottom.
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        borderBottomRightRadius: 28,
        borderBottomLeftRadius: 18,
        shadowColor: palette.shadowCool,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 22,
        elevation: 3,
      }}
    >
      {/* The gasket. A filled band, inset from the body's edge — the strip of
          rubber you see when the door is open, not an outline around the box. */}
      <YStack height={5} backgroundColor={palette.cabinetSeal} borderRadius={999} marginBottom={6} />

      <YStack
        flex={1}
        minHeight={0}
        backgroundColor={palette.cabinetLiner}
        overflow="hidden"
        style={{ borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomRightRadius: 22, borderBottomLeftRadius: 12 }}
      >
        {children}
        {/* The interior light, last so it falls over the top of the contents.
            `pointerEvents none` so it never eats a scroll or a tap. */}
        <LinearGradient
          pointerEvents="none"
          colors={[palette.cabinetColdLight, 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 96 }}
        />
      </YStack>
    </YStack>
  )
}

/** One compartment's label — the name of the shelf, and how much is on it. */
export function ShelfHeader({
  palette,
  icon,
  label,
  count,
}: {
  palette: SoftPalette
  icon: ReactNode
  label: string
  count: number
}) {
  const { t } = useTranslation()
  return (
    <XStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingTop="$3" paddingBottom="$2">
      {icon}
      <Text fontSize={11} fontWeight="800" letterSpacing={1.1} color={palette.cabinetInk}>
        {label.toUpperCase()}
      </Text>
      <YStack flex={1} />
      <Text fontSize={11} fontWeight="600" color={palette.cabinetInkSecondary}>{t('fridge.product', { count: count })}</Text>
    </XStack>
  )
}

/**
 * The glass plate the shelf above it stands on: a translucent pane, then the
 * front lip that catches the light. Two fills, no stroke.
 */
export function ShelfRail({ palette }: { palette: SoftPalette }) {
  return (
    <YStack marginHorizontal="$2" marginTop="$2">
      <YStack height={3} backgroundColor={palette.shelfGlass} borderRadius={999} />
      <YStack height={3} backgroundColor={palette.shelfEdge} borderRadius={999} marginTop={1} opacity={0.75} />
    </YStack>
  )
}
