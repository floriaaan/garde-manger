/**
 * The one shared chrome for every screen — extracted after an audit found
 * BlobBackground + SafeAreaView + ScrollView + isWide/Sidebar wiring
 * copy-pasted independently across household-dashboard/fridge-list/
 * recipe-list/shopping-list (each slightly different: different
 * paddingBottom, different `edges`), while settings/receipts skipped the
 * shell entirely. Two real regressions this fixes:
 *
 * — the mobile bottom nav (glass pill + lime FAB) previously existed only
 *   on the dashboard screen; every other screen left the user with no
 *   persistent way back to another section except the OS back gesture.
 * — the BlurView glass pill was hardcoded `tint="light"`, so it stayed a
 *   light frosted pill even in dark mode. Fixed here, in one place.
 *
 * Three nav shapes:
 * — `{ kind: 'tab', tab, onScan }` for the four top-level sections
 *   (Accueil/Garde-manger/Recettes/Courses): mobile gets the glass pill + FAB,
 *   desktop gets the Sidebar with that tab highlighted.
 * — `{ kind: 'stack' }` for pushed detail screens (Réglages, Historique
 *   des tickets — not one of the four tabs): mobile carries no bottom
 *   nav (the screen renders its own BackButton in its header, same
 *   convention recipe/shopping-list already used), desktop still gets the
 *   Sidebar (DESIGN.md's tablet/desktop frame is universal, not
 *   per-screen-opt-in) but with nothing highlighted, since none of the
 *   four sections is "active" from a settings/receipts screen.
 * — `{ kind: 'modal' }` for a screen presented modally (the recipe
 *   composer). Same ground, safe area and content measure as the rest, but
 *   no bottom nav *and no Sidebar at any width*: a modal sits on top of the
 *   frame it was opened from, so re-drawing that frame's own navigation
 *   inside it offers a way out of a sheet that only Fermer should close.
 */
import { useState } from 'react'
import { Animated, Platform, Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { router } from 'expo-router'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useReduceMotion } from './hover.js'
import { IS_ANDROID, materialRoles, ripple, surfaceShadow } from './material.js'
import { Sidebar, type SidebarSection } from './sidebar.js'
import { BlobBackground } from './blob-background.js'
import { pullToRefreshControl, type RefreshBinding } from './pull-to-refresh.js'
import { HintBubble, type Hint } from './hint-bubble.js'
import {
  ChefHatIcon,
  HomeIcon,
  PackageIcon,
  ScanLineIcon,
  ShoppingCartIcon,
} from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { TourAnchor } from '../onboarding/tour-anchors.js'

export const TABLET_BREAKPOINT = 768

const TAB_LABELS: Record<SidebarSection, string> = {
  accueil: 'Accueil',
  frigo: 'Garde-manger',
  recettes: 'Recettes',
  courses: 'Courses',
}

const TAB_ROUTES: Record<SidebarSection, string> = {
  accueil: '/(tabs)',
  frigo: '/(tabs)/fridge',
  recettes: '/(tabs)/recipes',
  courses: '/(tabs)/shopping-list',
}

const TAB_ORDER: SidebarSection[] = ['accueil', 'frigo', 'recettes', 'courses']

const TAB_ICONS: Record<SidebarSection, (color: string) => React.ReactNode> = {
  accueil: (color) => <HomeIcon size={18} color={color} />,
  frigo: (color) => <PackageIcon size={18} color={color} />,
  recettes: (color) => <ChefHatIcon size={18} color={color} />,
  courses: (color) => <ShoppingCartIcon size={18} color={color} />,
}

export type AppShellNav =
  | { kind: 'tab'; tab: SidebarSection; onScan: () => void }
  /**
   * `insideTabs`: this stack screen lives under `src/app/(tabs)/**` (a
   * detail route nested in one tab's own stack, e.g. `recipes/[id]`), so on
   * iOS the real `NativeTabs` bar — owned by `(tabs)/_layout.tsx`, a
   * navigator entirely outside `AppShell` — stays on screen through the
   * push. Leave it `false`/omitted for a screen that lives outside
   * `(tabs)` entirely (Réglages, Historique des tickets), where iOS shows
   * no tab bar at all.
   */
  | { kind: 'stack'; insideTabs?: boolean }
  | { kind: 'modal' }

export interface AppShellProps {
  nav: AppShellNav
  hint?: Hint | null
  contentMaxWidth?: number
  /**
   * Default `true`: children render inside AppShell's own ScrollView.
   * Pass `false` when the screen owns a virtualized list (`FlatList`) as
   * its scroll container instead — nesting a FlatList inside AppShell's
   * ScrollView would defeat the virtualization it exists for. Pair with
   * `useAppShellLayout()` + `shellContentStyle()` so the list's own
   * `contentContainerStyle` matches every other screen's padding.
   */
  scrollable?: boolean
  /**
   * Pull-to-refresh for the shell's own ScrollView. Build it with
   * `usePullToRefresh(...)` from every query the screen displays. A screen
   * that owns its list (`scrollable={false}`) passes the control to that
   * list itself instead — see `pullToRefreshControl`.
   */
  refresh?: RefreshBinding
  /**
   * The screen's title block, pinned above the scroll area rather than
   * scrolled with the content. Always a `ScreenHeader`: every screen names
   * itself the same way, in the same place, and that name does not leave when
   * you scroll — which is what made a long fridge or a long receipt feel like
   * a page with no title at all.
   */
  header?: React.ReactNode
  /**
   * A handle on the shell's own ScrollView, plus its live offset.
   *
   * Only the first-run tour uses these, and it needs both: it anchors its
   * spotlight on real elements of the screen underneath, and two of those
   * (the Recettes/Courses tiles) sit below the fold on a phone. Measuring
   * gives it a window rectangle; turning that into a scroll target needs the
   * offset the window rectangle was measured at. Both are optional and inert
   * for every other screen.
   */
  scrollRef?: React.RefObject<ScrollView | null>
  onScrollOffset?: (offset: number) => void
  children: React.ReactNode
}

/**
 * `.navigate`, not `.push`: pushing a tab switch stacked a history entry on
 * every hop, so Android's back button unwound the whole tab-hopping session
 * instead of leaving the app. `navigate` also happens to be the action iOS's
 * NativeBottomTabsRouter special-cases for jumping between tabs.
 */
function goToTab(tab: SidebarSection) {
  router.navigate(TAB_ROUTES[tab] as never)
}

/**
 * iOS gets the real `NativeTabs` bar (see `(tabs)/_layout.tsx`) — Liquid
 * Glass on iOS 26+, standard native chrome below that — so `AppShell` must
 * not also draw its own custom pill there. Android/web keep the BlurView
 * pill built in this file.
 */
const IS_NATIVE_TAB_PLATFORM = Platform.OS === 'ios'

/** The fixed desktop sidebar, and the `$4` of `layoutSurface` around the content pane. */
export const SIDEBAR_WIDTH = 220
const FRAME_PADDING = 16

/** Layout facts a screen needs to build its own scroll container against (see `scrollable={false}`). */
export function useAppShellLayout(nav: AppShellNav, contentMaxWidth = 640) {
  const { width } = useWindowDimensions()
  /**
   * iPhone landscape width crosses 768 on most modern devices — a bug
   * report (2026-09): a tab screen switched into the desktop Sidebar frame
   * in landscape while the real iOS tab bar, a separate navigator this
   * component does not control, stayed on screen too, so both showed at
   * once. `Platform.isPad` is iOS's own idiom flag — only a real iPad
   * should read as "wide" there. Android/web have no such navigator outside
   * this component's control, so width alone still decides for them.
   */
  const isWide = width >= TABLET_BREAKPOINT && (Platform.OS !== 'ios' || Platform.isPad)
  const hasMobileNav = nav.kind === 'tab' && !isWide
  // True whenever the real iOS tab bar is the one on screen — either this
  // is a tab root, or a stack screen nested under it (see `insideTabs` on
  // `AppShellNav`). Both need the same bottom clearance; neither draws
  // AppShell's own pill (`hasMobileNav` alone still gates that, below).
  const isNativeTabBar =
    !isWide && IS_NATIVE_TAB_PLATFORM && (nav.kind === 'tab' || (nav.kind === 'stack' && nav.insideTabs === true))
  /**
   * The measure a screen may actually draw into, padding excluded.
   *
   * A screen that sizes a child off `useWindowDimensions` is wrong on desktop
   * by the whole frame: the sidebar and the pane's margin are not content. At
   * the 768pt breakpoint the window is 768 and the column is 476 — a card sized
   * `min(640, width) - 40` came out 600 and pushed everything beside it off the
   * screen, silently, because it lived in a horizontal ScrollView. Only above
   * ~872pt did the two numbers happen to agree.
   */
  const paneWidth = isWide && nav.kind !== 'modal' ? width - SIDEBAR_WIDTH - FRAME_PADDING * 2 : width
  const contentWidth = Math.max(240, Math.min(paneWidth, isWide ? contentMaxWidth : width) - 40)
  return { isWide, hasMobileNav, isNativeTabBar, contentWidth }
}

/** The padding/max-width recipe every AppShell-driven scroll container shares. */
export function shellContentStyle({
  isWide,
  hasMobileNav,
  contentMaxWidth = 640,
}: {
  isWide: boolean
  hasMobileNav: boolean
  contentMaxWidth?: number
}) {
  return {
    paddingHorizontal: 20,
    // Android's Material bar is 80dp of solid chrome plus its own safe-area
    // inset, with the FAB floating above it; the iOS/web pill floats over the
    // content and needs less.
    paddingBottom: hasMobileNav ? (IS_ANDROID ? 168 : 140) : 40,
    paddingTop: isWide ? 32 : 20,
    maxWidth: isWide ? contentMaxWidth : undefined,
    width: isWide ? ('100%' as const) : undefined,
    alignSelf: isWide ? ('center' as const) : undefined,
  }
}

/** Exported: also rendered inside iOS's `NativeTabs.BottomAccessory` (see `(tabs)/_layout.tsx`). */
export function Fab({ onScan }: { onScan: () => void }) {
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const [scale] = useState(() => new Animated.Value(1))
  function spring(toValue: number, friction: number, tension: number) {
    if (reduceMotion) {
      Animated.timing(scale, { toValue, duration: 0, useNativeDriver: true }).start()
      return
    }
    Animated.spring(scale, { toValue, friction, tension, useNativeDriver: true }).start()
  }
  return (
    // The first-run tour's fourth beat points here. `TourAnchor` is a plain
    // passthrough outside the dashboard's provider, so every other screen's
    // FAB is unchanged by it.
    <TourAnchor id="fab">
    <Pressable
      onPress={onScan}
      onHoverIn={() => spring(1.06, 6, 200)}
      onHoverOut={() => spring(1, 5, 160)}
      onPressIn={() => spring(0.86, 5, 200)}
      onPressOut={() => spring(1, 4, 160)}
      testID="scan-fab"
      accessibilityRole="button"
      // The button opens a two-choice sheet; naming only one of them stated an
      // outcome the control does not deliver.
      accessibilityLabel="Scanner un produit ou un ticket de caisse"
      style={pointerCursor}
    >
      <Animated.View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: palette.accentLime,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
          shadowColor: palette.shadowCool,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        <ScanLineIcon size={24} color={palette.accentLimeText} />
      </Animated.View>
    </Pressable>
    </TourAnchor>
  )
}

function TabBarItem({ section, active }: { section: SidebarSection; active: boolean }) {
  const palette = useSoftPalette()
  const color = active ? palette.accentLimeText : palette.inkSecondary
  return (
    <Pressable
      onPress={() => (active ? undefined : goToTab(section))}
      accessibilityRole="button"
      accessibilityLabel={TAB_LABELS[section]}
      accessibilityState={{ selected: active }}
      style={pointerCursor}
    >
      {/* minHeight 44: touch-target floor, same convention as Sidebar's SidebarItem. */}
      <YStack
        alignItems="center"
        justifyContent="center"
        gap="$1"
        minHeight={44}
        minWidth={52}
        paddingVertical="$1.5"
        paddingHorizontal="$2"
        borderRadius={999}
        backgroundColor={active ? palette.accentLime : 'transparent'}
      >
        {TAB_ICONS[section](color)}
        <Text fontSize={10} fontWeight="700" color={color}>
          {TAB_LABELS[section]}
        </Text>
      </YStack>
    </Pressable>
  )
}

/**
 * A Material 3 navigation-bar destination: a 32×64 pill "active indicator"
 * behind the icon only, the label always visible under it, 48dp of touch
 * height, and a bounded ripple. This is the shape M3 specifies, and it is
 * deliberately *not* the iOS/web pill above — the whole item does not fill
 * with colour, only the indicator behind the glyph does.
 */
function MaterialNavItem({ section, active }: { section: SidebarSection; active: boolean }) {
  const palette = useSoftPalette()
  const roles = materialRoles(palette)
  const color = active ? roles.onSecondaryContainer : roles.onSurfaceVariant
  return (
    <Pressable
      onPress={() => (active ? undefined : goToTab(section))}
      accessibilityRole="tab"
      accessibilityLabel={TAB_LABELS[section]}
      accessibilityState={{ selected: active }}
      android_ripple={ripple(roles.onSurfaceVariant, { borderless: true, radius: 40 })}
      style={{ flex: 1 }}
    >
      <YStack alignItems="center" justifyContent="center" gap={4} minHeight={48} paddingVertical={12}>
        <YStack
          width={64}
          height={32}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          backgroundColor={active ? roles.secondaryContainer : 'transparent'}
        >
          {TAB_ICONS[section](color)}
        </YStack>
        <Text fontSize={12} fontWeight={active ? '700' : '500'} color={color}>
          {TAB_LABELS[section]}
        </Text>
      </YStack>
    </Pressable>
  )
}

/**
 * Android's bottom chrome, per Material 3: a full-width navigation bar on
 * `surfaceContainer` sitting flush to the bottom edge — not a floating
 * frosted pill, which is an iOS idiom the app was shipping to both platforms
 * (the audit's headline conformance finding). The FAB keeps its one job and
 * moves above the bar at the trailing edge, which is where M3 puts it.
 */
function MaterialTabNav({ tab, onScan }: { tab: SidebarSection; onScan: () => void }) {
  const palette = useSoftPalette()
  const roles = materialRoles(palette)
  return (
    <YStack position="absolute" left={0} right={0} bottom={0}>
      <YStack position="absolute" right={16} bottom={96}>
        <Fab onScan={onScan} />
      </YStack>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: roles.surfaceContainer }}>
        <XStack
          alignItems="center"
          justifyContent="space-around"
          backgroundColor={roles.surfaceContainer}
          minHeight={80}
          style={surfaceShadow(palette, 2, { offsetY: -2, opacity: 0.06, radius: 10 })}
        >
          {TAB_ORDER.map((section) => (
            <MaterialNavItem key={section} section={section} active={section === tab} />
          ))}
        </XStack>
      </SafeAreaView>
    </YStack>
  )
}

function MobileTabNav({ tab, onScan }: { tab: SidebarSection; onScan: () => void }) {
  const palette = useSoftPalette()
  return (
    <YStack position="absolute" left={0} right={0} bottom={0} alignItems="center" paddingBottom={18}>
      <XStack alignItems="center" gap="$3" width="92%" justifyContent="space-between">
        <BlurView
          intensity={40}
          tint={palette.blurTint}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          {TAB_ORDER.map((section) => (
            <TabBarItem key={section} section={section} active={section === tab} />
          ))}
        </BlurView>
        <Fab onScan={onScan} />
      </XStack>
    </YStack>
  )
}

export function AppShell({
  nav,
  hint,
  contentMaxWidth = 640,
  scrollable = true,
  refresh,
  header,
  scrollRef,
  onScrollOffset,
  children,
}: AppShellProps) {
  const palette = useSoftPalette()
  const { isWide, hasMobileNav, isNativeTabBar } = useAppShellLayout(nav)
  // What actually needs the bottom clearance below: AppShell's own drawn
  // pill/bar (`hasMobileNav`), or the real iOS tab bar persisting through a
  // nested-stack push (`isNativeTabBar` — see `insideTabs` on `AppShellNav`).
  // Either way nothing here draws a *second* bar: `hasMobileNav` alone still
  // gates that below.
  const reservesBottomChrome = hasMobileNav || isNativeTabBar
  const contentStyle = shellContentStyle({ isWide, hasMobileNav: reservesBottomChrome, contentMaxWidth })

  const content = (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <BlobBackground blobStrong={palette.blobStrong} blobSoft={palette.blobSoft} ground={palette.gradientBottom} />
      {/* `left`/`right` too: once the orientation lock came off, a landscape
          notch would otherwise eat the header's back button.

          **No `bottom` edge when a mobile nav is drawn.** Both bottom chromes
          are absolutely positioned *outside* this SafeAreaView and carry their
          own inset — Material's bar wraps itself in `edges={['bottom']}`, the
          iOS/web pill sits on a fixed 18pt. Insetting the scroll surface too
          ended it above the home indicator, so the list stopped dead at the tab
          bar with a band of bare ground under it instead of scrolling beneath
          the floating pill, which is the whole point of a floating pill. The
          room the chrome needs is already reserved by `shellContentStyle`'s
          `paddingBottom`. A `kind: 'stack'` screen with no tab bar underneath
          it (real or drawn) has no bottom chrome, so it keeps the edge. */}
      <SafeAreaView
        style={{ flex: 1, minHeight: 0 }}
        edges={isWide ? ['left', 'right'] : reservesBottomChrome ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      >
        {header ? <PinnedHeader contentStyle={contentStyle}>{header}</PinnedHeader> : null}
        {scrollable ? (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, minHeight: 0 }}
            // `flexGrow: 1`: lets short content (an empty state) fill and
            // vertically center in the visible area instead of pinning to
            // the top — a no-op once content is taller than the screen,
            // which is the ordinary case, so nothing else here changes.
            contentContainerStyle={{ ...contentStyle, paddingTop: header ? 4 : contentStyle.paddingTop, flexGrow: 1 }}
            refreshControl={refresh ? pullToRefreshControl(refresh, palette) : undefined}
            onScroll={onScrollOffset ? (event) => onScrollOffset(event.nativeEvent.contentOffset.y) : undefined}
            scrollEventThrottle={onScrollOffset ? 16 : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <YStack flex={1} minHeight={0}>
            {children}
          </YStack>
        )}
      </SafeAreaView>
      {nav.kind === 'tab' && !isWide && !isNativeTabBar ? (
        IS_ANDROID ? (
          <MaterialTabNav tab={nav.tab} onScan={nav.onScan} />
        ) : (
          <MobileTabNav tab={nav.tab} onScan={nav.onScan} />
        )
      ) : null}
      <HintBubble hint={hint ?? null} palette={palette} />
    </YStack>
  )

  // A modal is already framed by the sheet it is presented in — it takes the
  // phone layout at every width, capped by the same content measure.
  if (!isWide || nav.kind === 'modal') return content

  const activeTab = nav.kind === 'tab' ? nav.tab : undefined

  return (
    <SafeAreaView style={{ flex: 1, minHeight: 0, backgroundColor: palette.layoutSurface }} edges={['top', 'bottom']}>
      <XStack flex={1} minHeight={0} backgroundColor={palette.layoutSurface}>
        <Sidebar
          palette={palette}
          active={activeTab}
          onOpenAccueil={() => (activeTab === 'accueil' ? undefined : goToTab('accueil'))}
          onOpenFrigo={() => (activeTab === 'frigo' ? undefined : goToTab('frigo'))}
          onOpenRecettes={() => (activeTab === 'recettes' ? undefined : goToTab('recettes'))}
          onOpenCourses={() => (activeTab === 'courses' ? undefined : goToTab('courses'))}
          onOpenReglages={() => router.push('/settings')}
          onScan={nav.kind === 'tab' ? nav.onScan : () => goToTab('accueil')}
        />
        <YStack flex={1} minHeight={0} padding="$4" style={{ position: 'relative' }}>
          <YStack
            flex={1}
            minHeight={0}
            overflow="hidden"
            style={{
              borderRadius: 28,
              shadowColor: palette.shadowWarm,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.16,
              shadowRadius: 22,
              elevation: 4,
            }}
          >
            {content}
          </YStack>
        </YStack>
      </XStack>
    </SafeAreaView>
  )
}

/**
 * The pinned title block. It sits outside the ScrollView, takes the same
 * horizontal measure and max-width as the content below it so the title lines
 * up with the first card, and carries no fill of its own — the blob ground
 * shows through, exactly as it did when the header scrolled.
 *
 * No fill and no shadow: it was given `gradientBottom` plus a drop shadow to
 * separate it from the scrolling content, but the header is a sibling *above*
 * the ScrollView, not a layer over it — nothing ever passes under it to be
 * separated from. All the fill did was punch an opaque flat band across the
 * BlobBackground, which is the one thing the ground is there to show.
 */
function PinnedHeader({
  contentStyle,
  children,
}: {
  contentStyle: ReturnType<typeof shellContentStyle>
  children: React.ReactNode
}) {
  return (
    <YStack
      paddingHorizontal={contentStyle.paddingHorizontal}
      paddingTop={contentStyle.paddingTop}
      paddingBottom={12}
      width="100%"
      maxWidth={contentStyle.maxWidth}
      alignSelf={contentStyle.alignSelf ?? 'stretch'}
      style={{ zIndex: 2 }}
    >
      {children}
    </YStack>
  )
}
