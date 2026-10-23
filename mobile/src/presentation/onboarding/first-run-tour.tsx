import { t, useTranslation } from '../../i18n/index.js'
// Short, optional prompts over real dashboard controls. Each workflow can
// be opened immediately; leaving the tour dismisses it until an explicit replay.
import { useCallback, useEffect, useState } from 'react'
import { Animated, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable } from '../shared/pressable.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { pointerCursor, useReduceMotion } from '../shared/hover.js'
import { ArrowRightIcon, CheckIcon, ChefHatIcon, PlusIcon, ScanLineIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useTourAnchors, type AnchorBox, type TourAnchorId } from './tour-anchors.js'

interface Beat {
  id: TourAnchorId
  title: string
  body: string
  action?: 'inventory' | 'recipes' | 'scan'
}

const BEATS: Beat[] = [
  {
    id: 'hero',
    action: 'inventory',
    get title() { return t('onboarding.inventory_title') },
    get body() { return t('onboarding.inventory_prompt') },
  },
  {
    id: 'stats',
    get title() { return t('onboarding.three_numbers_three_lists') },
    get body() { return t('onboarding.what_expires_this_week_what_is_past_its_expiry_date') },
  },
  {
    id: 'navcards',
    action: 'recipes',
    get title() { return t('onboarding.recipes_title') },
    get body() { return t('onboarding.recipes_prompt') },
  },
  {
    id: 'fab',
    action: 'scan',
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
  onAddProduct,
  onOpenRecipes,
  onFinish,
}: {
  scrollRef: React.RefObject<ScrollView | null>
  /** The offset the last measurement happened at — turns a window rectangle into a scroll target. */
  scrollOffset: React.RefObject<number>
  onScan: () => void
  onAddProduct: () => void
  onOpenRecipes: () => void
  onFinish: () => void
}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const { measure } = useTourAnchors()
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<AnchorBox | null>(null)
  const [bubbleHeight, setBubbleHeight] = useState(BUBBLE_ESTIMATED_HEIGHT)
  const [fade] = useState(() => new Animated.Value(0))

  const beat = BEATS[index]
  const isLast = index === BEATS.length - 1
  const action = beat.action === 'inventory'
    ? { label: t('onboarding.add_product'), run: onAddProduct, Icon: PlusIcon }
    : beat.action === 'recipes'
      ? { label: t('onboarding.open_recipes'), run: onOpenRecipes, Icon: ChefHatIcon }
      : beat.action === 'scan'
        ? { label: t('dashboard.scan'), run: onScan, Icon: ScanLineIcon }
        : null

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
    if (!first) return null

    const topLimit = 90
    const bottomLimit = windowHeight - BUBBLE_ESTIMATED_HEIGHT - 40
    const needsScroll = first.y < topLimit || first.y + first.height > bottomLimit

    if (!needsScroll || !scrollRef.current) {
      return first
    }

    scrollRef.current.scrollTo({
      y: Math.max(0, scrollOffset.current + first.y - topLimit),
      animated: !reduceMotion,
    })
    // Long enough for an animated scroll to settle; an instant one under
    // Reduce Motion simply measures a frame later than it had to.
    await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 60 : 380))
    return measure(beat.id)
  }, [beat.id, measure, reduceMotion, scrollRef, scrollOffset, windowHeight])

  useEffect(() => {
    let cancelled = false
    fade.setValue(0)
    // Ignore stale measurements after changing steps, resizing or leaving.
    focusBeat().then((measured) => {
      if (cancelled) return
      setBox(measured)
      if (reduceMotion) {
        fade.setValue(1)
        return
      }
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start()
    })
    return () => {
      cancelled = true
      fade.stopAnimation()
    }
  }, [focusBeat, fade, reduceMotion, windowWidth])

  const hole = box
    ? {
        top: Math.max(0, box.y - SPOTLIGHT_PADDING),
        left: Math.max(0, box.x - SPOTLIGHT_PADDING),
        width: box.width + SPOTLIGHT_PADDING * 2,
        height: box.height + SPOTLIGHT_PADDING * 2,
      }
    : null

  // Clamp the prompt inside the safe area; large text can scroll within it.
  const topLimit = insets.top + 12
  const bottomLimit = windowHeight - insets.bottom - 12
  const bubbleTop = hole
    ? hole.top + hole.height + bubbleHeight + 14 < bottomLimit
      ? hole.top + hole.height + 14
      : hole.top - bubbleHeight - 14
    : (windowHeight - bubbleHeight) / 2
  const bubbleStyle = { top: Math.max(topLimit, Math.min(bubbleTop, bottomLimit - bubbleHeight)) }

  return (
    <YStack
      testID="first-run-tour"
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      accessibilityViewIsModal
      onAccessibilityEscape={onFinish}
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
          maxWidth={480}
          maxHeight={Math.max(0, bottomLimit - topLimit)}
          onLayout={(event) => setBubbleHeight(event.nativeEvent.layout.height)}
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
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
            <YStack
              gap="$2"
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 1,
                max: BEATS.length,
                now: index + 1,
                text: t('onboarding.step_progress', { current: index + 1, total: BEATS.length }),
              }}
            >
              <XStack gap="$1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {BEATS.map((step, stepIndex) => (
                  <YStack
                    key={step.id}
                    flex={1}
                    height={6}
                    borderRadius={999}
                    backgroundColor={stepIndex <= index ? palette.navCardTeal : palette.creamPillEdge}
                  />
                ))}
              </XStack>
              <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>
                {t('onboarding.step_progress', { current: index + 1, total: BEATS.length })}
              </Text>
            </YStack>
            <Text fontSize={20} fontWeight="800" color={palette.ink}>
              {beat.title}
            </Text>
            <Text fontSize={14} fontWeight="500" color={palette.inkSecondary}>
              {beat.body}
            </Text>

            {action ? (
              <PillButton
                testID={`first-run-tour-${beat.action}`}
                label={action.label}
                fullWidth
                icon={(color) => <action.Icon size={20} color={color} />}
                tone="quiet"
                onPress={() => {
                  onFinish()
                  action.run()
                }}
                palette={palette}
              />
            ) : null}
            <PillButton
              testID="first-run-tour-next"
              label={isLast ? t('onboarding.let_s_go') : t('onboarding.next')}
              fullWidth
              icon={(color) => isLast ? <CheckIcon size={20} color={color} /> : <ArrowRightIcon size={20} color={color} />}
              onPress={() => (isLast ? onFinish() : setIndex(index + 1))}
              palette={palette}
            />
            <XStack marginTop="$2" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$3">
              <Pressable
                testID="first-run-tour-skip"
                onPress={onFinish}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.skip_introduction')}
                style={[pointerCursor, { minHeight: 48, justifyContent: 'center' }]}
              >
                <Text fontSize={13} fontWeight="700" color={palette.inkSecondary}>{t('onboarding.skip')}</Text>
              </Pressable>

              {index > 0 ? (
                <PillButton
                  testID="first-run-tour-back"
                  label={t('onboarding.back')}
                  tone="quiet"
                  onPress={() => setIndex(index - 1)}
                  palette={palette}
                />
              ) : null}
            </XStack>
          </ScrollView>
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
