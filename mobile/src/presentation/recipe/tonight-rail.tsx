/**
 * "Ce soir" — the top half of the Recettes screen.
 *
 * The tab used to open on a uniform feed ordered by creation date, which
 * answers "quelles recettes ai-je gardées" — a question nobody standing in
 * their kitchen at 19h is asking. This band answers the one they are asking:
 * what to cook now, and which product it saves. It only appears when the
 * garde-manger actually has something due this week (see `pickTonight`), so
 * the reason it gives is never invented.
 *
 * One rich surface, per DESIGN.md: the lead candidate is the screen's hero,
 * and the alternates beside it are light. That is the hierarchy the band
 * exists for — one answer, then the other two.
 */
import { useEffect, useState } from 'react'
import { Animated, PixelRatio, Pressable, ScrollView } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress, useReduceMotion } from '../shared/hover.js'
import { ripple, rippleClip } from '../shared/material.js'
import { HeroWarmGlow } from '../dashboard/hero-warm-glow.js'
import { ClockIcon, TriangleAlertIcon } from '../dashboard/dashboard-icons.js'
import { expiryLabel } from '../dashboard/product-status.js'
import { MetaChip } from './meta-chip.js'
import { CORNERS, CORNER_ROTATION } from './recipe-card.js'

const HERO_CORNERS = {
  borderTopLeftRadius: 36,
  borderTopRightRadius: 20,
  borderBottomRightRadius: 36,
  borderBottomLeftRadius: 20,
}
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { pantrySentence } from './pantry-match.js'
import type { TonightCandidate } from './pantry-match.js'

/**
 * The alternates are narrower than the lead on purpose, and one always peeks
 * past the fold — but the width grows with the type.
 *
 * A fixed 196 around a three-line title and two chips is a box that cannot hold
 * its contents once the OS text size goes up; the card is the same shape at
 * every setting and the words are what stop fitting. `PixelRatio.getFontScale`
 * is the scale the user actually chose, capped so a 2× setting does not make
 * one alternate wider than the hero it is an alternative to.
 */
const ALTERNATE_BASE_WIDTH = 196
const RAIL_GAP = 12

function alternateWidth(): number {
  return Math.round(ALTERNATE_BASE_WIDTH * Math.min(PixelRatio.getFontScale(), 1.5))
}

/**
 * A ScrollView clips on both axes — `overflow-x: auto` implies `overflow-y:
 * auto` in CSS, and RN's native scrollers behave the same — so the cards' own
 * shadows were being sliced off flat against the rail's edges: a soft 28pt blur
 * ending in a hard horizontal line, which is the one thing a shadow must never
 * do. The rail is padded to give the blur its room and pulled back by the same
 * amount in margin, so the shadows fall freely without the band growing.
 */
const RAIL_SHADOW_ROOM_TOP = 10
const RAIL_SHADOW_ROOM_BOTTOM = 44

/**
 * How much of an ingredient list the foyer already owns, drawn rather than
 * only counted: a cook scanning three candidates compares bars faster than
 * fractions. Lime because this system spends its one saturated colour on
 * progress and on nothing else.
 */
function CoverageGauge({
  owned,
  total,
  fill,
  track,
}: {
  owned: number
  total: number
  fill: string
  track: string
}) {
  // Past eight ingredients the segments are thinner than the gaps between
  // them; the sentence under the bar carries the exact numbers anyway.
  const segments = Math.min(total, 8)
  const filled = Math.round((owned / total) * segments)
  return (
    <XStack gap="$1" alignItems="center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: segments }, (_, index) => (
        <YStack key={index} flex={1} height={6} borderRadius={999} backgroundColor={index < filled ? fill : track} />
      ))}
    </XStack>
  )
}

/**
 * What a screen reader hears on a shortlist card.
 *
 * Two things the visible cards say and these labels used to swallow: the
 * preparation time — drawn as a clock pill and described here as the one fact a
 * cook checks first — and the word "estimation". The rows below carry that
 * qualifier already; the cards that state the number most confidently were the
 * two saying it as fact.
 */
function spokenLabel({ recipe, match, rescue, rescueDays }: TonightCandidate): string {
  return [
    recipe.title,
    `Utilise ${rescue.name}, ${expiryLabel(rescueDays).toLowerCase()}`,
    recipe.preparationTime ? `${recipe.preparationTime} minutes` : null,
    match.total > 0 ? `${pantrySentence(match)}${match.estimated ? ', estimation' : ''}` : null,
  ]
    .filter(Boolean)
    .join('. ')
}

function TonightHero({
  candidate,
  palette,
  width,
  onPress,
}: {
  candidate: TonightCandidate
  palette: SoftPalette
  width: number
  onPress: () => void
}) {
  const hover = useHoverPress()
  const { recipe, match, rescue, rescueDays } = candidate

  return (
    <Pressable
      testID={`recipe-tonight-${recipe.id}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={spokenLabel(candidate)}
      android_ripple={ripple(palette.onDark)}
      style={[pointerCursor, rippleClip(HERO_CORNERS)]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], width, flex: 1 }}>
        {/* Two boxes: the outer one carries the fill, radius and shadow and
            stays unpadded so the glow fills it edge to edge. */}
        <YStack
          backgroundColor={palette.brandDeep}
          overflow="hidden"
          style={{
            ...HERO_CORNERS,
            position: 'relative',
            shadowColor: palette.shadowCool,
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.22,
            shadowRadius: 28,
            elevation: 6,
          }}
        >
          <HeroWarmGlow warm={palette.accentWarm} ground={palette.brandDeep} />
          <YStack padding="$5" gap="$3">
            {/* The clock rides beside the title rather than below it: it is the
                one fact a cook checks before reading anything else, and giving
                it its own row cost a line the phone did not have. */}
            <XStack alignItems="flex-start" gap="$3">
              {/* `lineHeight` scales with the type rather than pinning 28pt: a
                  fixed leading clips the second line of a title the OS has
                  scaled up, which is exactly the case a two-line title is for.
                  The clock keeps its width but is allowed to drop below the
                  title once the row can no longer hold both. */}
              <Text
                flex={1}
                fontSize={22}
                fontWeight="800"
                color={palette.brandDeepText}
                lineHeight={Math.round(28 * Math.min(PixelRatio.getFontScale(), 1.6))}
                numberOfLines={2}
              >
                {recipe.title}
              </Text>
              {recipe.preparationTime ? (
                <XStack
                  alignItems="center"
                  gap="$1.5"
                  flexShrink={0}
                  marginTop="$1"
                  backgroundColor={palette.heroPillFill}
                  paddingVertical="$1.5"
                  paddingHorizontal="$3"
                  borderRadius={999}
                >
                  <ClockIcon size={13} color={palette.brandDeepText} />
                  <Text fontSize={12} fontWeight="700" color={palette.brandDeepText}>
                    {recipe.preparationTime} min
                  </Text>
                </XStack>
              ) : null}
            </XStack>

            {/* A band that wraps, not a pill that hugs. The product and its date
                were two pills, then one, and at a phone's ~266pt of inner width
                both spellings ellipsised the product down to "Épinar…" — the
                fault was the pill *hugging* its text, not the fill. Dropping the
                fill altogether fixed the wrap and broke something worse:
                `soonOnDark` is contrast-tuned against `heroPillFill`, and on
                bare `brandDeep` it measures 4.23:1, under the floor. So the wash
                stays (6.26:1), the shape softens to a 16pt band, and the text
                shrinks and wraps inside it instead of being clipped by it. */}
            <XStack
              alignItems="flex-start"
              gap="$1.5"
              alignSelf="flex-start"
              maxWidth="100%"
              backgroundColor={palette.heroPillFill}
              paddingVertical="$1.5"
              paddingHorizontal="$3"
              borderRadius={16}
            >
              <YStack marginTop={2}>
                <TriangleAlertIcon size={13} color={palette.soonOnDark} />
              </YStack>
              <Text fontSize={12} fontWeight="700" color={palette.soonOnDark} lineHeight={17} flexShrink={1}>
                {rescue.name} · {expiryLabel(rescueDays)}
              </Text>
            </XStack>

            {recipe.description ? (
              <Text fontSize={13} fontWeight="500" color={palette.brandDeepTextSecondary} lineHeight={19} numberOfLines={2}>
                {recipe.description}
              </Text>
            ) : null}

            {match.total > 0 ? (
              <YStack gap="$2" marginTop="$1">
                <CoverageGauge owned={match.owned} total={match.total} fill={palette.accentLime} track={palette.heroPillFill} />
                <Text fontSize={12} fontWeight="600" color={palette.brandDeepTextSecondary}>
                  {pantrySentence(match)}
                </Text>
              </YStack>
            ) : null}
          </YStack>
        </YStack>
      </Animated.View>
    </Pressable>
  )
}

function TonightAlternate({
  candidate,
  palette,
  index,
  onPress,
}: {
  candidate: TonightCandidate
  palette: SoftPalette
  /** Position among the alternates — the two beside the hero must not share one corner set. */
  index: number
  onPress: () => void
}) {
  const hover = useHoverPress()
  const { recipe, match, rescue, rescueDays } = candidate

  return (
    <Pressable
      testID={`recipe-tonight-${recipe.id}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={spokenLabel(candidate)}
      android_ripple={ripple(palette.ink)}
      style={[pointerCursor, rippleClip(CORNERS[CORNER_ROTATION[(index + 1) % CORNER_ROTATION.length]])]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], width: alternateWidth(), flex: 1 }}>
        <YStack
          flex={1}
          gap="$2.5"
          padding="$4"
          backgroundColor={palette.cream}
          style={{
            // Rotated with the library's own three sets: two adjacent cards of
            // the same purpose sharing one corner set is the No-Uniform-Radius
            // rule's exact failure case, and these two sat side by side.
            ...CORNERS[CORNER_ROTATION[(index + 1) % CORNER_ROTATION.length]],
            shadowColor: palette.shadowCool,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 18,
            elevation: 3,
          }}
        >
          <Text fontSize={15} fontWeight="800" color={palette.ink} lineHeight={20} numberOfLines={3}>
            {recipe.title}
          </Text>
          {/* Icon *and* colour *and* word. The chip carried the glyph, the
              `soon` tint and the product's name — so nothing on it actually
              said the product was about to expire; the name was a decoy label
              on a colour-only status. And at ~140pt of usable width one line
              ellipsised any real product name, which is the truncation the hero
              was just rebuilt to lose. Two lines, and the date is stated. */}
          <YStack
            gap="$0.5"
            backgroundColor={palette.soonBg}
            paddingVertical="$1.5"
            paddingHorizontal="$2.5"
            borderRadius={14}
            alignSelf="flex-start"
            maxWidth="100%"
          >
            <XStack alignItems="flex-start" gap="$1.5">
              <YStack marginTop={1}>
                <TriangleAlertIcon size={12} color={palette.soonText} />
              </YStack>
              <Text fontSize={11} fontWeight="700" color={palette.soonText} lineHeight={15} flexShrink={1} numberOfLines={2}>
                {rescue.name}
              </Text>
            </XStack>
            <Text fontSize={11} fontWeight="600" color={palette.soonText} lineHeight={15}>
              {expiryLabel(rescueDays)}
            </Text>
          </YStack>
          <YStack flex={1} justifyContent="flex-end" gap="$2">
            {match.total > 0 ? (
              <CoverageGauge owned={match.owned} total={match.total} fill={palette.accentLime} track={palette.mintPale} />
            ) : null}
            <XStack gap="$1.5" flexWrap="wrap">
              {/* The same spelling the rows below use — "2/3 chez toi" here and
                  "2 sur 3 chez toi" underneath read as two different facts. */}
              <MetaChip label={pantrySentence(match, { short: true })} tone={match.owned > 0 ? 'pantry' : 'muted'} palette={palette} />
              {recipe.preparationTime ? <MetaChip label={`${recipe.preparationTime} min`} tone="time" palette={palette} /> : null}
            </XStack>
          </YStack>
        </YStack>
      </Animated.View>
    </Pressable>
  )
}

export function TonightRail({
  candidates,
  palette,
  leadWidth,
  onOpen,
}: {
  candidates: readonly TonightCandidate[]
  palette: SoftPalette
  /** The lead card is the column's width minus a peek, so the rail declares itself scrollable. */
  leadWidth: number
  onOpen: (recipeId: string) => void
}) {
  const reduceMotion = useReduceMotion()
  const [entrance] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (reduceMotion) {
      // The settled state without the rise — an instant cut, not a 0.01ms fade.
      entrance.setValue(1)
      return
    }
    Animated.spring(entrance, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start()
  }, [entrance, reduceMotion])

  const [lead, ...alternates] = candidates

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <YStack gap="$1" marginBottom="$3">
        {/* 20/800 — DESIGN.md's Title step, drawn exactly as `ScreenHeader`
            draws it, tracking included (there is none). At 15 it was the same
            size and weight as a library row's title, so the screen's two halves
            had no break between them. */}
        <Text fontSize={20} fontWeight="800" color={palette.ink} accessibilityRole="header">
          Ce soir
        </Text>
        {/* The disclosure sits here, once, rather than on every card: the
            rapprochement between an ingredient and a product is a name match
            made on this device, and it is allowed to be wrong. */}
        <Text fontSize={12} fontWeight="500" color={palette.inkSecondary}>
          Ce qui utilise ce qu’il faut finir — disponibilité estimée d’après les noms.
        </Text>
      </YStack>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // The rail lives inside the shell's padded column, so the peek is what
        // says "there is more" — there is no bleeding past the margin here.
        contentContainerStyle={{
          gap: RAIL_GAP,
          paddingTop: RAIL_SHADOW_ROOM_TOP,
          paddingBottom: RAIL_SHADOW_ROOM_BOTTOM,
          alignItems: 'stretch',
        }}
        style={{ marginTop: -(RAIL_SHADOW_ROOM_TOP - 4), marginBottom: -(RAIL_SHADOW_ROOM_BOTTOM - 4) }}
      >
        <TonightHero candidate={lead} palette={palette} width={leadWidth} onPress={() => onOpen(lead.recipe.id)} />
        {alternates.map((candidate, index) => (
          <TonightAlternate
            key={candidate.recipe.id}
            candidate={candidate}
            palette={palette}
            index={index}
            onPress={() => onOpen(candidate.recipe.id)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  )
}
