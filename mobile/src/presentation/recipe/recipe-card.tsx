/**
 * A recipe in the library — the lower half of the Recettes screen.
 *
 * Deliberately quieter than it used to be. Every row carried the same 44pt
 * chef-hat square, which is exactly the icon DESIGN.md's "don't repeat one
 * identical glyph down a row" rule is about: it distinguished no row from its
 * neighbour and pushed the title into a narrower column. What replaces it is
 * the one thing that *does* differ per row and that no generic recipe app can
 * print — how much of the dish is already in the foyer's garde-manger.
 */
import { Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple, rippleClip } from '../shared/material.js'
import { EllipsisIcon } from '../dashboard/dashboard-icons.js'
import { MetaChip } from './meta-chip.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { pantrySentence } from './pantry-match.js'
import type { PantryMatch } from './pantry-match.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

/**
 * `cream`, never `gradientBottom` — that token *is* the desktop content card,
 * so a white row on it survives on its shadow alone, and in dark mode the
 * shadow is a faint warm glow: the row disappears into the page. The same
 * mistake the dashboard's `ReceiptsRow` was corrected for.
 */

/** Three corner sets, rotated by index — a row of same-purpose cards must not read as stamped. */
export const CORNERS = {
  a: { borderTopLeftRadius: 24, borderTopRightRadius: 14, borderBottomRightRadius: 24, borderBottomLeftRadius: 14 },
  b: { borderTopLeftRadius: 14, borderTopRightRadius: 24, borderBottomRightRadius: 14, borderBottomLeftRadius: 24 },
  c: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 14, borderBottomLeftRadius: 28 },
} as const

export type RecipeCorner = keyof typeof CORNERS

/** The rotation itself, so every surface that stacks these cards steps through the same three. */
export const CORNER_ROTATION: RecipeCorner[] = ['a', 'b', 'c']

const MAX_TAGS = 2

export function RecipeCard({
  recipe,
  match,
  palette,
  corner,
  provenance,
  deleting = false,
  onPress,
  onOpenActions,
}: {
  recipe: Recipe
  /** `null` while the garde-manger is still loading, or when it could not be read. */
  match: PantryMatch | null
  palette: SoftPalette
  corner: RecipeCorner
  /**
   * "Cuisinée 2 fois · Camille, hier", or `null` when there is nothing true to
   * say. The library is the foyer's most shared artefact and rendered no trace
   * of who put a row there or whether anyone had ever made it.
   */
  provenance: string | null
  /** Confirmed for deletion and awaiting the server — the row is inert, not merely dimmed. */
  deleting?: boolean
  onPress: () => void
  onOpenActions: () => void
}) {
  const hover = useHoverPress()
  const pantry = match && match.total > 0 ? pantrySentence(match, { short: true }) : null
  /**
   * Spoken, the count has to carry the qualifier the screen prints once above
   * the list: the backend never links an ingredient to a product, so this is a
   * name match made on this device. A screen reader that hears "2 sur 3 chez
   * toi" and nothing else has been told a fact the app cannot know.
   */
  const spokenPantry = pantry && match?.estimated ? `${pantry}, estimation` : pantry

  return (
    <Animated.View style={{ transform: [{ scale: hover.scale }], opacity: deleting ? 0.45 : 1 }}>
      <YStack
        backgroundColor={palette.cream}
        style={{
          ...CORNERS[corner],
          position: 'relative',
          shadowColor: palette.shadowCool,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.06,
          shadowRadius: 14,
          elevation: 2,
        }}
      >
        <Pressable
          testID={`recipe-card-${recipe.id}`}
          disabled={deleting}
          onPress={onPress}
          // The long press survives alongside the visible control below: it is
          // the gesture a returning user already learned on the garde-manger and
          // the shopping list, and it costs nothing to keep.
          onLongPress={onOpenActions}
          onHoverIn={hover.onHoverIn}
          onHoverOut={hover.onHoverOut}
          onPressIn={hover.onPressIn}
          onPressOut={hover.onPressOut}
          accessibilityRole="button"
          accessibilityState={{ disabled: deleting, busy: deleting }}
          // React Native collapses the children into one label, so without this the
          // pantry count and the time — the reason the row is worth reading — are
          // silent.
          accessibilityLabel={[
            recipe.title,
            deleting ? 'suppression en cours' : null,
            provenance,
            spokenPantry,
            recipe.preparationTime ? `${recipe.preparationTime} minutes` : null,
          ]
            .filter(Boolean)
            .join(', ')}
          android_ripple={ripple(palette.ink)}
          style={[pointerCursor, rippleClip(CORNERS[corner])]}
        >
          <YStack gap="$2" padding="$4" paddingRight={52}>
            <Text fontSize={15} fontWeight="800" color={palette.ink}>
              {recipe.title}
            </Text>
            {recipe.description ? (
              <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} lineHeight={17} numberOfLines={2}>
                {recipe.description}
              </Text>
            ) : null}
            {provenance ? (
              <Text fontSize={11} fontWeight="600" color={palette.creamText}>
                {provenance}
              </Text>
            ) : null}
            <XStack gap="$1.5" flexWrap="wrap" marginTop="$0.5">
              {pantry ? (
                <MetaChip label={pantry} tone={match && match.owned > 0 ? 'pantry' : 'muted'} palette={palette} />
              ) : null}
              {recipe.preparationTime ? (
                <MetaChip label={`${recipe.preparationTime} min`} tone="time" palette={palette} />
              ) : null}
              {recipe.tags.slice(0, MAX_TAGS).map((tag) => (
                <MetaChip key={tag} label={tag} tone="tag" palette={palette} />
              ))}
            </XStack>
          </YStack>
        </Pressable>

        {/*
          The row's actions, visible. Delete used to answer only to a long
          press: undisclosed on a phone, unlabelled to a pointer, and with no
          convention at all on the web build. It is a sibling of the card's
          Pressable rather than a child of it, because RN Web renders
          `accessibilityRole="button"` as a real `<button>` and a button inside
          a button is invalid. 28pt drawn, 48pt pressable — and the growth is
          *padding*, not `hitSlop`, because `react-native-web` ignores that prop
          and would otherwise ship a 28pt target on web for the one destructive
          action on the row. Padding works on all three platforms; anchoring the
          box at 0,0 puts the glyph back at the 10,10 the design wants.
        */}
        <Pressable
          testID={`recipe-actions-${recipe.id}`}
          disabled={deleting}
          onPress={onOpenActions}
          accessibilityRole="button"
          accessibilityLabel={`Actions pour « ${recipe.title} »`}
          android_ripple={ripple(palette.ink, { borderless: true, radius: 20 })}
          style={[pointerCursor, { position: 'absolute', top: 0, right: 0, padding: 10 }]}
        >
          <YStack width={28} height={28} alignItems="center" justifyContent="center" borderRadius={999}>
            <EllipsisIcon size={16} color={palette.inkSecondary} />
          </YStack>
        </Pressable>
      </YStack>
    </Animated.View>
  )
}
