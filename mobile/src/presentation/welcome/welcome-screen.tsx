/**
 * The pre-auth welcome screen — a real 3-page carousel: swipe or
 * "Continuer" moves through three photo+headline pages sharing one layout,
 * "Passer" reaches the same destination from any of them. The layout
 * itself hasn't changed since the single-photo version: photo zone at
 * `flex:1`, one hero panel below it, the panel's geometry untouched — only
 * the photo zone became swipeable (a real horizontal `ScrollView`, one
 * full-bleed photo per page) and the panel's text/dots/footer now read off
 * the settled page index instead of one fixed string.
 *
 * The photo zone pages natively (real horizontal translation, not a
 * simulated one); each photo fades in on its own `onLoad`, independent of
 * the page transition, so a slow connection shows the `brandDeep` ground
 * rather than a hard pop once the bytes arrive. The panel's title/subtitle
 * fade on every index change — swipe-driven or button-driven — the same
 * entrance timing the single-photo version played once on mount, just
 * retriggered per page. Opacity only, no vertical motion: a `translateY`
 * on the same node the height-measurement below reads from used to clip
 * the bottom of the text for as long as the transform stayed non-zero,
 * since layout measurement ignores transform but the wrapping
 * `overflow:hidden` box does not — a real bug this screen shipped once
 * already. Move again, measure elsewhere.
 *
 * The three titles wrap to different numbers of lines ("Le foyer partage la
 * même étagère" is longer than "Scanne, c'est rangé"), so the panel's own
 * height genuinely changes page to page. The title/subtitle block's real
 * height is measured via `onLayout` and animated — same rule as
 * `AuthMethodFooter`'s chooser↔form transition: read the real content
 * instead of guessing a constant, and never let visibility depend on the
 * first measurement having already landed. That measured node carries no
 * transform of its own (see above) — only opacity, which doesn't affect
 * layout and so can't fight the height animation the way `translateY` did.
 *
 * The panel content sits in a `ScrollView` capped at 78% of the window's
 * height, the same ceiling `AuthShell` uses for its own panel — a landscape
 * phone (or any short viewport) can't fit a 44px headline, a subtitle, three
 * dots and two stacked full-width buttons without a scroll escape hatch,
 * and this screen didn't have one before even though its sibling did.
 *
 * The bottom panel IS the hero card, at screen scale: the exact structure
 * `household-dashboard.tsx`'s hero card uses (an unpadded outer box carrying
 * fill/radius, `HeroWarmGlow` as its direct child, a padded inner stack for
 * content), just flush to the screen's own edges instead of floating on a
 * padded ground — which is also why it keeps only the hero card's *top*
 * corner pair (36/20) and skips the bottom pair and the hero-lift shadow
 * entirely: both exist to separate a floating card from the ground around
 * it, and there is no ground on three of this panel's four sides.
 *
 * The headline runs at `onboarding-display` (44/900, DESIGN.md) — a size
 * above the in-app `display` ceiling, because this is the one screen in the
 * app that is a single decisive moment rather than a dense view. Its
 * `lineHeight` (like the subtitle's) scales with `PixelRatio.getFontScale()`
 * — the same pattern `tonight-rail.tsx` already uses — because a numeric
 * `lineHeight` does not follow the OS text-size setting the way `fontSize`
 * does on its own, and a title this size is exactly where that gap shows.
 *
 * Not `AppShell`: no session yet, no tab, no bottom nav, no Sidebar.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Animated, Easing, Image, PixelRatio, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AuthButton } from '../identity/auth-button.js'
import { AuthWordmark } from '../identity/auth-wordmark.js'
import { HeroWarmGlow } from '../dashboard/hero-warm-glow.js'
import { KITCHEN_PHOTO_URIS } from '../shared/kitchen-photo.js'
import { pointerCursor, pressAreaSlop, useHoverPress, useReduceMotion } from '../shared/hover.js'
import { ripple } from '../shared/material.js'
import { hexToRgba } from '../shared/hex-to-rgba.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

const MAX_CONTENT_WIDTH = 640
// Plain padding here, not `SafeAreaView`'s bottom edge — see the note this
// used to carry about a suspected native-measurement collapse. That theory
// didn't hold up, but the fullscreen-on-focus feature built on top of it
// broke something real, and this stayed simple through the revert: a flat
// constant trades exact per-device precision for a guaranteed-correct layout.
const BOTTOM_INSET_FALLBACK = Platform.select({ ios: 24, default: 12 })
/** Same cap `tonight-rail.tsx` uses for its own scaled `lineHeight` — unbounded growth at an extreme accessibility text size would blow the layout out further than it needs to just to stay legible. */
const MAX_FONT_SCALE = 1.6

interface Page {
  photo: string
  title: string
  subtitle: string
}

const PAGES: Page[] = [
  {
    photo: KITCHEN_PHOTO_URIS[1],
    title: 'Ton frigo, d’un coup d’œil',
    subtitle: 'Ce qui est à consommer en premier, sans ouvrir la porte.',
  },
  {
    photo: KITCHEN_PHOTO_URIS[0],
    title: 'Scanne, c’est rangé',
    subtitle: 'Un ticket de caisse, et les produits arrivent sur l’étagère.',
  },
  {
    photo: KITCHEN_PHOTO_URIS[2],
    title: 'Le foyer partage la même étagère',
    subtitle: 'Chacun voit ce qu’il reste et ce qu’il faut racheter.',
  },
]

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const panelMaxHeight = Math.round(windowHeight * 0.78)
  const fontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE)
  const scrollRef = useRef<ScrollView | null>(null)
  const [index, setIndex] = useState(0)
  const [contentOpacity] = useState(() => new Animated.Value(reduceMotion ? 1 : 0))
  const [textHeight] = useState(() => new Animated.Value(0))
  const [hasMeasuredText, setHasMeasuredText] = useState(false)
  const [photoFades] = useState(() => PAGES.map(() => new Animated.Value(0)))
  const isLast = index === PAGES.length - 1

  // Replays on every page change, not just on mount — the single-photo
  // screen this replaced only ever played this once; a carousel needs the
  // same "just arrived" feel on every page, swiped to or pressed to. A
  // short dip-then-rise rather than a hard `setValue(0)` snap: a page
  // change landing mid-fade of the previous one (fast/erratic swiping,
  // or "Continuer" tapped while a swipe's momentum is still settling)
  // used to cut straight to invisible instead of crossfading through it.
  useEffect(() => {
    if (reduceMotion) {
      contentOpacity.setValue(1)
      return
    }
    Animated.sequence([
      Animated.timing(contentOpacity, { toValue: 0, duration: 120, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start()
  }, [index, reduceMotion, contentOpacity])

  const onMeasureText = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height
      if (!hasMeasuredText) {
        textHeight.setValue(next)
        setHasMeasuredText(true)
        return
      }
      if (reduceMotion) {
        textHeight.setValue(next)
        return
      }
      Animated.timing(textHeight, { toValue: next, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    },
    [hasMeasuredText, textHeight, reduceMotion],
  )

  // A head start on the network fetch for every page's photo, not just the
  // current one — swiping ahead on a slow connection otherwise shows the
  // `brandDeep` ground through an unloaded image for a beat.
  useEffect(() => {
    PAGES.forEach((page) => {
      // Optional chaining, not a bare `.catch()` — RN's own jest mock for
      // `Image` has no `prefetch` at all, so this crashed every render of
      // this screen under test until now (nothing had ever exercised it).
      Image.prefetch(page.photo)?.catch(() => {})
    })
  }, [])

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return
      if (next >= PAGES.length) {
        onDone()
        return
      }
      setIndex(next)
      scrollRef.current?.scrollTo({ x: next * windowWidth, animated: !reduceMotion })
    },
    [windowWidth, onDone, reduceMotion],
  )

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const settled = Math.round(event.nativeEvent.contentOffset.x / windowWidth)
    if (settled !== index) setIndex(settled)
  }

  // Arrow-key navigation on web — Tab between "Continuer" and "Passer"
  // already works, it's real DOM focus order (they're stacked in that
  // order below).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') goTo(index + 1)
      else if (event.key === 'ArrowLeft') goTo(index - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goTo, index])

  const skipHover = useHoverPress()
  const page = PAGES[index]

  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.brandDeep}>
      {/* The photo's own zone — everything above the hero panel. `flex:1`
          rather than a fixed height, so the panel below (sized by its own
          content) is what actually varies the split across devices, not a
          hardcoded photo height that clips differently per screen. */}
      <YStack flex={1} minHeight={0} style={{ position: 'relative' }}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          // Default deceleration, not `"fast"` — `"fast"` is tuned for a
          // scroll that stops wherever the finger releases, and paging
          // fights it on every swipe: the page still has to travel the
          // rest of the way to the next snap point, and doing that at
          // "fast"'s sharper stop reads as a snap instead of a glide.
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          style={StyleSheet.absoluteFill}
        >
          {PAGES.map((p, i) => (
            <View key={i} style={{ width: windowWidth }}>
              {/* `brandDeep` behind the photo, not white — a slow network
                  shows the system's own warm surface for a beat instead of
                  a flash of the near-white ground. Fades in on its own
                  `onLoad`, independent of the page-change fade above, so a
                  slow connection shows the ground for a beat rather than a
                  hard pop once the image finally arrives. */}
              <Animated.Image
                source={{ uri: p.photo }}
                onLoad={() => {
                  Animated.timing(photoFades[i], {
                    toValue: 1,
                    duration: reduceMotion ? 0 : 300,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                  }).start()
                }}
                resizeMode="cover"
                accessibilityLabel=""
                style={[StyleSheet.absoluteFill, { opacity: photoFades[i] }]}
              />
            </View>
          ))}
        </Animated.ScrollView>
        {/* A short vignette for the wordmark alone, built from `shadowCool`
            itself (the token behind `scrim`) — not a whole-screen wash. The
            photos need no darkening past the first ~15% of their own
            height; the panel below does that job. `pointerEvents="none"`
            so it never blocks the swipe underneath it. */}
        <LinearGradient
          colors={[hexToRgba(palette.shadowCool, 0.5), hexToRgba(palette.shadowCool, 0)]}
          locations={[0, 0.32]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <SafeAreaView edges={['top']} pointerEvents="none">
          <YStack paddingHorizontal={24} paddingTop={16}>
            <AuthWordmark tone="on-dark" />
          </YStack>
        </SafeAreaView>
      </YStack>

      {/* The hero card, at screen scale — see the file comment for why this
          keeps only the top corner pair and no hero-lift shadow. */}
      <YStack
        backgroundColor={palette.brandDeep}
        overflow="hidden"
        style={{ position: 'relative', borderTopLeftRadius: 36, borderTopRightRadius: 20 }}
      >
        <HeroWarmGlow warm={palette.accentWarm} ground={palette.brandDeep} />
        {/* Capped and scrollable, not a plain auto-height column — see the
            file comment: a landscape phone can't always fit this much
            panel content, and `AuthShell` already solved this exact
            problem for its own (very similar) panel. */}
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ maxHeight: panelMaxHeight }}>
          <YStack
            style={{
              width: '100%',
              maxWidth: MAX_CONTENT_WIDTH,
              alignSelf: 'center',
              paddingHorizontal: 28,
              paddingTop: 32,
              paddingBottom: 20 + BOTTOM_INSET_FALLBACK,
              gap: 20,
            }}
          >
            {/* No transform on the `onLayout`-measured node — see the file
                comment: a `translateY` here used to clip the bottom of the
                text for as long as it stayed non-zero, since the wrapping
                `overflow:hidden` box is sized from the *untransformed*
                layout. Opacity alone doesn't affect layout, so it can't
                fight the height tween the same way. */}
            <Animated.View style={hasMeasuredText ? { height: textHeight, overflow: 'hidden' } : undefined}>
              <Animated.View onLayout={onMeasureText} style={{ opacity: contentOpacity, gap: 8 }}>
                <Text fontSize={44} fontWeight="900" lineHeight={46 * fontScale} letterSpacing={-1} color={palette.onDark}>
                  {page.title}
                </Text>
                <Text fontSize={14} fontWeight="500" lineHeight={20 * fontScale} color={palette.onDarkSecondary}>
                  {page.subtitle}
                </Text>
              </Animated.View>
            </Animated.View>

            <XStack
              gap="$2"
              justifyContent="center"
              alignItems="center"
              accessibilityRole="tablist"
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Diapositive ${index + 1} sur ${PAGES.length}`}
            >
              {PAGES.map((_, i) => (
                <View
                  key={i}
                  testID={`welcome-dot-${i}`}
                  style={{
                    width: i === index ? 20 : 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: i === index ? palette.accentLime : palette.cream,
                  }}
                />
              ))}
            </XStack>

            {/* Stacked, not side-by-side — "Continuer"/"Commencer" is the
                same full-width pill `AuthButton` is everywhere else in the
                app; squeezed into a row next to "Passer" it read as two
                cramped controls fighting for the same line, and its own
                width jumping between the two labels' different lengths made
                that row visibly resize on every page change. */}
            <YStack gap="$2">
              <AuthButton testID="welcome-continue" label={isLast ? 'Commencer' : 'Continuer'} onPress={() => goTo(index + 1)} />
              <Pressable
                testID="welcome-skip"
                onPress={onDone}
                onHoverIn={skipHover.onHoverIn}
                onHoverOut={skipHover.onHoverOut}
                onPressIn={skipHover.onPressIn}
                onPressOut={skipHover.onPressOut}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                android_ripple={ripple(palette.onDarkSecondary, { borderless: true })}
                accessibilityRole="button"
                accessibilityLabel="Passer la présentation"
                style={[pointerCursor, pressAreaSlop(12, 12)]}
              >
                <Animated.View style={{ transform: [{ scale: skipHover.scale }], alignItems: 'center', paddingTop: 2 }}>
                  <Text fontSize={14} fontWeight="700" color={palette.onDarkSecondary}>
                    Passer
                  </Text>
                </Animated.View>
              </Pressable>
            </YStack>
          </YStack>
        </ScrollView>
      </YStack>
    </YStack>
  )
}
