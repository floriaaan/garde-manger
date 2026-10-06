import { t, useTranslation } from '../../i18n/index.js'
/*
 * The house, once the threshold is crossed.
 *
 * Four beats, laid over the dashboard that is already loaded, pointing at the
 * real hero card, the real metrics, the real tiles and the real scanner. The
 * alternative was four illustrated slides before the app opens, which is the
 * arrangement this direction refuses: a slide can promise anything, and the
 * user still meets the actual screen for the first time afterwards, alone.
 *
 * One beat at a time — never four explanations open at once. The spotlight is
 * four scrim rectangles around a hole rather than a mask, because that reads
 * identically on iOS, Android and the web build and needs no compositing
 * tricks. Every beat is skippable, and skipping is permanent: an onboarding
 * that comes back is a punishment for having dismissed it.
 *
 * The dashboard of a brand-new foyer is empty, and the beats say so rather
 * than describing numbers that all read zero — each one names what its
 * section will do and, on the last, offers the scanner. Offers: the user
 * asked for no forced first scan, and a tour that ends by demanding one is a
 * step wearing a tooltip's clothes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, useWindowDimensions, type ScrollView } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { pointerCursor, useReduceMotion } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useTourAnchors, type AnchorBox, type TourAnchorId } from './tour-anchors.js'

interface Beat {
  id: TourAnchorId
  title: string
  body: string
}

const BEATS: Beat[] = [
  {
    id: 'hero',
    get title() { return t('onboarding.what_needs_using_first') },
    get body() { return t('onboarding.this_card_answers_tonight_s_question_what_should_you_eat') },
  },
  {
    id: 'stats',
    get title() { return t('onboarding.three_numbers_three_lists') },
    get body() { return t('onboarding.what_expires_this_week_what_is_past_its_expiry_date') },
  },
  {
    id: 'navcards',
    get title() { return t('onboarding.recipes_and_shopping') },
    get body() { return t('onboarding.recipes_uses_what_you_already_have_shopping_is_the_list') },
  },
  {
    id: 'fab',
    get title() { return t('onboarding.the_shortcut') },
    get body() { return t('onboarding.photograph_your_fridge_or_a_receipt_to_add_every_product') },
  },
]

/** Room the bubble needs under an anchor before the tour puts it above instead. */
const BUBBLE_ESTIMATED_HEIGHT = 210
const SPOTLIGHT_PADDING = 8

export function FirstRunTour({
  scrollRef,
  scrollOffset,
  onScan,
  onFinish,
}: {
  scrollRef: React.RefObject<ScrollView | null>
  /** The offset the last measurement happened at — turns a window rectangle into a scroll target. */
  scrollOffset: React.RefObject<number>
  onScan: () => void
  onFinish: () => void
}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const { measure } = useTourAnchors()
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<AnchorBox | null>(null)
  const [fade] = useState(() => new Animated.Value(0))

  const beat = BEATS[index]
  const isLast = index === BEATS.length - 1

  /**
   * Bring the beat's anchor on screen, then measure it where it landed.
   *
   * Two of the four anchors sit below the fold on a phone, and a spotlight
   * drawn around a rectangle that is off screen is a full-screen scrim with no
   * hole in it — the failure mode looks like a bug, not like a missing
   * feature. The measure runs twice on purpose: once to find out where the
   * element currently is, once after the scroll has settled to find out where
   * it ended up.
   */
  const focusBeat = useCallback(async () => {
    const first = await measure(beat.id)
    if (!first) {
      setBox(null)
      return
    }

    const topLimit = 90
    const bottomLimit = windowHeight - BUBBLE_ESTIMATED_HEIGHT - 40
    const needsScroll = first.y < topLimit || first.y + first.height > bottomLimit

    if (!needsScroll || !scrollRef.current) {
      setBox(first)
      return
    }

    scrollRef.current.scrollTo({
      y: Math.max(0, scrollOffset.current + first.y - topLimit),
      animated: !reduceMotion,
    })
    // Long enough for an animated scroll to settle; an instant one under
    // Reduce Motion simply measures a frame later than it had to.
    await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 60 : 380))
    setBox(await measure(beat.id))
  }, [beat.id, measure, reduceMotion, scrollRef, scrollOffset, windowHeight])

  useEffect(() => {
    let cancelled = false
    fade.setValue(0)
    // The layout *is* the external system this effect synchronises with:
    // `focusBeat` measures where the anchor actually landed, which cannot be
    // known before the commit and is not derivable from any prop. The rule
    // reads the call as a synchronous setState because it cannot see the
    // await inside; nothing here re-renders in a cascade — the measurement
    // resolves once per beat.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    focusBeat().then(() => {
      if (cancelled) return
      if (reduceMotion) {
        fade.setValue(1)
        return
      }
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start()
    })
    return () => {
      cancelled = true
    }
  }, [focusBeat, fade, reduceMotion])

  // A re-measure when the window changes size (a rotation, a resized browser
  // window): the hole would otherwise stay where the card used to be.
  const lastSize = useRef(`${windowWidth}x${windowHeight}`)
  useEffect(() => {
    const size = `${windowWidth}x${windowHeight}`
    if (size === lastSize.current) return
    lastSize.current = size
    focusBeat()
  }, [windowWidth, windowHeight, focusBeat])

  const hole = box
    ? {
        top: Math.max(0, box.y - SPOTLIGHT_PADDING),
        left: Math.max(0, box.x - SPOTLIGHT_PADDING),
        width: box.width + SPOTLIGHT_PADDING * 2,
        height: box.height + SPOTLIGHT_PADDING * 2,
      }
    : null

  // Under the anchor when there is room, above it otherwise, and vertically
  // centred when nothing could be measured at all.
  const bubbleBelow = hole ? hole.top + hole.height + BUBBLE_ESTIMATED_HEIGHT < windowHeight : true
  const bubbleStyle = hole
    ? bubbleBelow
      ? { top: hole.top + hole.height + 14 }
      : { bottom: windowHeight - hole.top + 14 }
    : { top: windowHeight / 2 - BUBBLE_ESTIMATED_HEIGHT / 2 }

  return (
    <YStack
      testID="first-run-tour"
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      accessibilityViewIsModal
      // The screen underneath is being explained, not operated: everything on
      // it is inert for the duration, so a tap meant for "Suivant" cannot
      // navigate away mid-tour.
      style={{ zIndex: 40 }}
    >
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {/* Four rectangles around the anchor rather than a mask: the same
            drawing on all three platforms, and the anchor keeps its own
            shadow and radius instead of being re-cut by a hole's edge. */}
        {hole ? (
          <>
            <Scrim palette={palette} style={{ top: 0, left: 0, right: 0, height: hole.top }} />
            <Scrim palette={palette} style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
            <Scrim palette={palette} style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
            <Scrim
              palette={palette}
              style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }}
            />
          </>
        ) : (
          <Scrim palette={palette} style={{ top: 0, left: 0, right: 0, bottom: 0 }} />
        )}

        <YStack
          position="absolute"
          left={16}
          right={16}
          {...bubbleStyle}
          backgroundColor={palette.gradientBottom}
          padding="$4"
          gap="$2"
          maxWidth={480}
          alignSelf="center"
          accessibilityLiveRegion="polite"
          style={{
            borderTopLeftRadius: 26,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 26,
            borderBottomLeftRadius: 14,
            shadowColor: palette.shadowCool,
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.22,
            shadowRadius: 28,
            elevation: 8,
          }}
        >
          <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>
            {index + 1} / {BEATS.length}
          </Text>
          <Text fontSize={20} fontWeight="800" color={palette.ink}>
            {beat.title}
          </Text>
          <Text fontSize={14} fontWeight="500" color={palette.inkSecondary}>
            {beat.body}
          </Text>

          <XStack marginTop="$2" alignItems="center" justifyContent="space-between" gap="$3">
            <Pressable
              testID="first-run-tour-skip"
              onPress={onFinish}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.skip_introduction')}
              style={pointerCursor}
            >
              <Text fontSize={13} fontWeight="700" color={palette.inkSecondary}>{t('onboarding.skip')}</Text>
            </Pressable>

            <XStack gap="$2" alignItems="center">
              {isLast ? (
                <PillButton
                  testID="first-run-tour-scan"
                  label={t('dashboard.scan')}
                  tone="quiet"
                  onPress={() => {
                    onFinish()
                    onScan()
                  }}
                  palette={palette}
                />
              ) : null}
              <PillButton
                testID="first-run-tour-next"
                label={isLast ? t('onboarding.let_s_go') : t('onboarding.next')}
                onPress={() => (isLast ? onFinish() : setIndex(index + 1))}
                palette={palette}
              />
            </XStack>
          </XStack>
        </YStack>
      </Animated.View>
    </YStack>
  )
}

function Scrim({ palette, style }: { palette: SoftPalette; style: Record<string, number | undefined> }) {
  // The system's own modal dimming layer, never a fresh literal — it is the
  // same "something else has the floor" signal the ActionSheet uses.
  return <YStack position="absolute" backgroundColor={palette.scrim} {...style} />
}
