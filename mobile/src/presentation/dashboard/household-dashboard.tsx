/*
 * DIRECTION CONTRACT — dashboard foyer (redesign, 2026-08-27; pushed
 * toward Material Expressive same day per follow-up feedback; wired to
 * real household data 2026-09-05 after a usability critique)
 *
 * User-pinned world, replacing the previously built "ticket de caisse"
 * direction outright (a pin beats the roll — new-work.md §"Commit the
 * world"). Not a concept-seed roll: the user supplied the full visual
 * vocabulary, mapped component-by-component onto the fridge domain, then
 * asked for more color/motion/expressive shape once the first pass read
 * as too quiet/sage.
 *
 * THESIS: the shared fridge reads as a soft, gamified progress dashboard —
 * one high-contrast dark hero the eye lands on first, everything else
 * pastel, asymmetric and floating, habit-app register applied to food
 * waste instead of streaks and lessons.
 * OWN-WORLD: mint-to-white radial "blob" ground (two soft off-center
 * gradients dissolving to white, never a flat top-to-bottom bar); one
 * warm-dark hero card (umber, not cold forest-black — an ember glow in
 * one corner), asymmetric-radius, as the surface's sole high-contrast
 * block; lime reserved for interactive/progress elements;
 * three pastel stat cards (cream/lavender/pale-mint) each with its own
 * asymmetric corner set and a solid saturated icon chip (orange /
 * violet / teal) instead of a bare icon; full-pill badges, wide
 * low-opacity floating shadows, no visible borders; one geometric sans,
 * hierarchy by size+weight only; status still redundantly icon+color
 * (mint/amber/coral), kept from the previous world's accessibility raise.
 * STORY: a foyer member opens the app, reads the hero in one glance
 * ("3 produits à cuisiner en premier"), scans the three metrics, acts on the
 * products about to go bad, then jumps to Recettes/Courses.
 *
 * DATA (2026-09-05): every number on this screen comes from the backend —
 * `useProductsQuery`, `useShoppingItemsQuery`, `useHouseholdQuery`. The
 * screen previously rendered `dashboard.fixture.ts`, which meant the home
 * page contradicted the user's own actions (import 20 products, still
 * reads "12") and showed every foyer the same invented name. Two elements
 * died with the fixture rather than being re-sourced:
 *   — the "12j sans gaspi" streak badge: no "days without waste" concept
 *     exists anywhere in the domain, so there was nothing to compute it
 *     from. Removed here and from the desktop Sidebar.
 *   — the "Consommé %" and "Valeur €" stat cards: SaaS-dashboard reflexes
 *     with no kitchen decision behind them. Replaced by the three counts a
 *     foyer member actually acts on — what expires this week, what has
 *     already expired, what is left to buy.
 * ORDER: "À consommer en premier" now sits directly under the metrics, above
 * "Accès rapide" — it is the answer to the question the screen exists to
 * answer, and it used to be a two-row footnote at the bottom of the scroll.
 *
 * FIRST VIEWPORT: a small transparent carrot illustration beside the
 * greeting (no background chip — two earlier rounds tried it as a boxed
 * tile above and inside the hero; both read as a separate component
 * rather than personality attached to the person you're greeting) +
 * a Réglages icon button, spring-entrance warm hero card (ember glow
 * corner) with headline + two status pills, three asymmetric pastel stat
 * cards (each one a link into what it counts — the garde-manger filtered to
 * that expiry window, or the liste de courses), the "À consommer en premier"
 * preview (top 4, each row opening that product), then "Accès rapide" — two
 * big saturated NavCards (Recettes / Courses) over a full-width
 * `ReceiptsRow` — closed by a floating glass pill (current
 * surface) and a lime FAB that scales down on press (the signature
 * interaction). Every Pressable spring-scales on hover (web) and press
 * (all platforms) via `useHoverPress`. At ≥768px width the phone's
 * floating pill+FAB are replaced by a persistent playful sidebar and the
 * whole dashboard becomes a rounded "insert" panel beside it — a two-pane
 * layout, not the phone layout stretched wide.
 * FORM: user-pinned direction, no concept-seed roll.
 *
 * DISCLOSED GAPS:
 * — 3D illustrations: the hero and both NavCards now carry real 3D
 *   renders (Microsoft Fluent Emoji 3D, MIT — carrot / pot-of-food /
 *   shopping-cart, see assets/illustrations/NOTICE.md) behind the glow,
 *   found by web search once image generation turned out unavailable
 *   this session. They're a found match, not the product's own
 *   commissioned set — swap for real product photography/illustration
 *   when that exists.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Image, type ImageSourcePropType, Pressable, type ScrollView } from 'react-native'
import {
  ChefHatIcon,
  ChevronRightIcon,
  ClockIcon,
  CircleXIcon,
  LayoutGridIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  ScanLineIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
} from './dashboard-icons.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress, useReduceMotion } from '../shared/hover.js'
import { useJobsQuery } from '../../application/job/jobs.query.js'
import { useReviewableDraftsQuery } from '../../application/job/scan-drafts.query.js'
import { isJobActive } from '../../domain/job/job.js'
import { AppShell } from '../shared/app-shell.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { goToScan } from '../shared/scan-sheet.js'
import { StatusChip } from './status-chip.js'
import { StatCard } from './stat-card.js'
import { HeroWarmGlow } from './hero-warm-glow.js'
import { NavCard } from './nav-card.js'
import { receiptsSummary } from './receipts-row.js'
import { ScanDraftBanner } from './scan-draft-banner.js'
import { MemberAvatars } from '../shared/member-avatars.js'
import { PillButton } from '../shared/pill-button.js'
import { useSoftPalette } from './soft-palette.js'
import type { SoftPalette } from './soft-palette.js'
import {
  daysUntilExpiry,
  expiryLabel,
  matchesExpiryWindow,
  sortByExpiry,
  statusOf,
  type ExpiryWindow,
  type ProductStatus,
} from './product-status.js'
import { SkeletonList } from '../shared/skeleton.js'
import { FirstRunTour } from '../onboarding/first-run-tour.js'
import { TourAnchor, TourAnchorProvider } from '../onboarding/tour-anchors.js'
import { useFirstRunTour } from '../onboarding/use-first-run-tour.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { useShoppingItemsQuery } from '../../application/shopping-list/shopping-items.query.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { platformCapabilities } from '../../application/shared/platform-capabilities.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useReceiptsQuery } from '../../application/receipt/receipts.query.js'
import type { Product } from '../../domain/fridge/product.js'

// Real 3D illustrations — Microsoft Fluent Emoji 3D (MIT license), bundled
// locally rather than fetched from a CDN at runtime (this app makes no
// direct client→external-service calls by design — see PRODUCT.md).
// Attribution: assets/illustrations/NOTICE.md.
const potOfFoodIllustration = require('../../../assets/illustrations/pot-of-food-3d.png') as ImageSourcePropType
const shoppingCartIllustration = require('../../../assets/illustrations/shopping-cart-3d.png') as ImageSourcePropType
const chartIncreasingIllustration = require('../../../assets/illustrations/chart-increasing-3d.png') as ImageSourcePropType
const receiptIllustration = require('../../../assets/illustrations/receipt-3d.png') as ImageSourcePropType
const mascotIllustration = require('../../../assets/mascot.png') as ImageSourcePropType
const mascotGold = require('../../../assets/mascot-gold.png') as ImageSourcePropType

/** Rows shown in the "À consommer en premier" preview before "Voir tout" takes over. */
const PREVIEW_COUNT = 4

export interface HouseholdDashboardProps {
  userName: string
  onOpenRecettes: () => void
  onOpenCourses: () => void
  /** With a window, the garde-manger opens filtered to it — that is what makes a stat card a link rather than a number. */
  onOpenFridge: (window?: ExpiryWindow) => void
  onOpenProduct: (productId: string) => void
  onAddProduct: () => void
  onOpenStats: () => void
  onOpenSettings: () => void
  onOpenTasks: () => void
  onOpenReceipts: () => void
  onOpenHousehold: () => void
}

export function HouseholdDashboard({
  userName,
  onOpenRecettes,
  onOpenCourses,
  onOpenFridge,
  onOpenProduct,
  onAddProduct,
  onOpenStats,
  onOpenSettings,
  onOpenTasks,
  onOpenReceipts,
  onOpenHousehold,
}: HouseholdDashboardProps) {
  const palette = useSoftPalette()
  const productsQuery = useProductsQuery()
  const shoppingQuery = useShoppingItemsQuery()
  const householdQuery = useHouseholdQuery()
  // Subscribers get the gold mascot in place of the regular one; the query is shared with the settings screens.
  const subscribed = useAiSettingsQuery().data?.access.plan === 'subscriber' && platformCapabilities.billing
  const receiptsQuery = useReceiptsQuery()

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const dated = useMemo(
    () => products.map((product) => ({ product, daysLeft: daysUntilExpiry(product) })),
    [products],
  )
  const soonProducts = useMemo(
    () => sortByExpiry(products).filter((product) => statusOf(daysUntilExpiry(product)) !== 'fresh'),
    [products],
  )
  const previewProducts = useMemo(
    // Once nothing is at risk, the preview still earns its place by showing
    // what to use up next rather than collapsing to an empty box.
    () => (soonProducts.length > 0 ? soonProducts : sortByExpiry(products)).slice(0, PREVIEW_COUNT),
    [soonProducts, products],
  )

  const expiredCount = dated.filter(({ daysLeft }) => statusOf(daysLeft) === 'expired').length
  // The shared predicate, not an inline threshold: this number is now the
  // label on a link, and the list behind it filters with the same function.
  // The old copy here was `daysLeft > 0`, which left a product expiring today
  // out of both this card and "Dates dépassées" — a gap you could survive in a
  // number and not in a link.
  const thisWeekCount = dated.filter(({ daysLeft }) => matchesExpiryWindow(daysLeft, 'week')).length
  const toBuyCount = (shoppingQuery.data ?? []).filter((item) => !item.checked).length
  /**
   * The hero's number, and the sum of the two cards under it — deliberately,
   * not coincidentally.
   *
   * It used to be `soonCount + expiredCount`, a −∞…3 window that appeared
   * nowhere else on the screen. So the hero could say 5 above a card reading 9
   * and a card reading 2, with no arithmetic connecting the three. Each number
   * was individually correct and the set was unreadable at the only speed a
   * dashboard is read at: one glance, one hand, fridge door open.
   *
   * It is now exactly `thisWeekCount + expiredCount` — the two stat cards
   * decompose it, and the two pills beneath the headline restate those same
   * two numbers. `statusOf`'s 3-day `soon` is untouched: that is a badge on one
   * product, a different question from how much the foyer has to get through
   * this week.
   */
  const watchCount = thisWeekCount + expiredCount

  const loading = productsQuery.isPending
  const failed = !productsQuery.isPending && productsQuery.isError
  const empty = !loading && !failed && products.length === 0
  const householdName = householdQuery.data?.name ?? 'Ton foyer'
  const memberNames = (householdQuery.data?.members ?? []).map((member) => member.name)

  const reduceMotion = useReduceMotion()
  const [entrance] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (reduceMotion) {
      // Preserve the state change (content becomes visible/settled) without
      // the fade+rise motion — an instant cut, not a "0.01ms" fade that
      // would still technically animate.
      entrance.setValue(1)
      return
    }
    Animated.spring(entrance, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start()
  }, [entrance, reduceMotion])

  const refresh = usePullToRefresh(
    () => productsQuery.refetch(),
    () => shoppingQuery.refetch(),
    () => householdQuery.refetch(),
    () => receiptsQuery.refetch(),
  )
  const seeAllHover = useHoverPress()
  const settingsHover = useHoverPress()
const tasksHover = useHoverPress()
const activeJobs = (useJobsQuery().data ?? []).filter(isJobActive).length
// Running jobs plus drafts waiting for review: everything that asks for the member's attention.
const pendingTasks = activeJobs + useReviewableDraftsQuery().length

  /**
   * The first-run tour runs over this screen rather than in front of it, so it
   * needs the shell's scroll handle to bring its later anchors into view. It
   * waits for the household read: the tour explains a foyer's dashboard, and
   * until we know there is one there is nothing to explain.
   */
  const scrollRef = useRef<ScrollView | null>(null)
  const scrollOffset = useRef(0)
  const tour = useFirstRunTour(Boolean(householdQuery.data))

  function statusBg(status: ProductStatus) {
    return status === 'expired' ? palette.expiredBg : status === 'soon' ? palette.soonBg : palette.freshBg
  }
  function statusText(status: ProductStatus) {
    return status === 'expired' ? palette.expiredText : status === 'soon' ? palette.soonText : palette.freshText
  }

  function heroHeadline() {
    if (loading) return 'On regarde dans ton garde-manger…'
    if (failed) return 'Garde-manger indisponible'
    if (empty) return 'Ton garde-manger est encore vide'
    return watchCount > 0
      ? `${watchCount} produit${watchCount > 1 ? 's' : ''} à cuisiner en premier`
      : 'Tout est frais aujourd’hui'
  }

  /** `—` rather than `0` while loading: an honest blank, not a wrong number. */
  function metric(value: number) {
    return loading || failed ? '—' : String(value)
  }

  /**
   * The spoken half of a stat card. It has to agree with `metric()`: the card
   * renders `—` while the query is in flight, and a label that interpolates the
   * count regardless announced a confident "0 produit" over an honest blank.
   */
  function metricLabel(name: string, value: number, unit: string, unavailable = loading || failed) {
    if (unavailable) return `${name}, chargement`
    return `${name}, ${value} ${unit}${value > 1 ? 's' : ''}`
  }

  return (
    <TourAnchorProvider>
    <AppShell
      nav={{ kind: 'tab', tab: 'accueil', onScan: goToScan }}
      refresh={refresh}
      scrollRef={scrollRef}
      onScrollOffset={(offset) => {
        scrollOffset.current = offset
      }}
      // The greeting is this screen's header, so it is pinned like every other
      // screen's — the mascot is its glyph and Réglages its trailing action. It
      // used to scroll away, which meant the one surface that names the foyer
      // stopped naming it as soon as you moved.
      header={
            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$2.5" flex={1}>
                {/* 44, not the carrot glyph's old 40 — the mascot is a full
                    character (face, arms, a held leaf), not a simple icon
                    shape, and needs a few more pixels than a flat glyph to
                    read at this size. Not 56: this screen is a dense
                    in-app view, so its text stays on the `title` scale
                    (20/800) DESIGN.md reserves `display` (24/800) away
                    from — sizing the glyph past what that text stack
                    actually measures just re-opens the vertical-centering
                    gap the previous pass tried to close by growing the
                    text past its own scale instead. */}
                {/* Subscribers get the gold twin of the mascot, same size. */}
                <Image
                  testID={subscribed ? 'dashboard-subscriber-badge' : undefined}
                  source={subscribed ? mascotGold : mascotIllustration}
                  style={{ width: 48, height: 48 }}
                  resizeMode="contain"
                  accessibilityLabel={subscribed ? 'Abonnement actif' : ''}
                />
                {/* The foyer, on the foyer's home screen. The one thing that
                    makes this product not a personal fridge tracker — several
                    people on one shelf — used to appear nowhere here, while
                    `MemberAvatars` sat two taps deep in Réglages. The block is
                    the way in: whoever you are looking at, you can go see who
                    they are. */}
                <Pressable
                  testID="dashboard-household"
                  onPress={onOpenHousehold}
                  accessibilityRole="button"
                  accessibilityLabel={
                    memberNames.length > 0
                      ? `${householdName}, ${memberNames.length} membre${memberNames.length > 1 ? 's' : ''} : ${memberNames.join(', ')}. Gérer le foyer`
                      : `${householdName}. Gérer le foyer`
                  }
                  style={[{ flex: 1 }, pointerCursor]}
                >
                  <YStack flex={1}>
                    {/* `body` (14/500) over `title` (20/800) — DESIGN.md's own
                        in-app scale, not bumped: this screen is a dense view,
                        the one place DESIGN.md keeps `display` (24/800) away
                        from ("this is the first screen a signed-out visitor
                        focuses on, not a dense in-app view" — the reasoning
                        for the auth card's own use of `display`). Growing
                        this past `title` to chase the mascot's size was the
                        wrong axis to move; the glyph is sized to this text,
                        not the other way round. */}
                    <Text fontSize={14} fontWeight="500" color={palette.inkSecondary}>
                      Salut, {userName || 'toi'}
                    </Text>
                    <XStack alignItems="center" gap="$2" marginTop="$1">
                      <Text fontSize={20} fontWeight="800" color={palette.ink} numberOfLines={1} flexShrink={1}>
                        {householdName}
                      </Text>
                      <MemberAvatars names={memberNames} palette={palette} max={3} />
                    </XStack>
                  </YStack>
                </Pressable>
              </XStack>
              <XStack alignItems="center" gap="$2">
              {/* Was an 11px grey text link — the app's only route to Réglages,
                  and invisible next to a 40px illustration. Now a real 44pt
                  icon button (the Sidebar carries its own entry on desktop). */}
              <Pressable
                onPress={onOpenTasks}
                testID="open-tasks"
                onHoverIn={tasksHover.onHoverIn}
                onHoverOut={tasksHover.onHoverOut}
                onPressIn={tasksHover.onPressIn}
                onPressOut={tasksHover.onPressOut}
                accessibilityRole="button"
                accessibilityLabel={pendingTasks > 0 ? `Tâches, ${pendingTasks} à suivre` : 'Tâches'}
                style={pointerCursor}
              >
                <Animated.View style={{ transform: [{ scale: tasksHover.scale }] }}>
                  <YStack
                    width={44}
                    height={44}
                    borderRadius={999}
                    backgroundColor={palette.cream}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <ClockIcon size={19} color={palette.ink} />
                    {pendingTasks > 0 ? (
                      <YStack
                        testID="open-tasks-badge"
                        position="absolute"
                        top={-4}
                        right={-4}
                        minWidth={18}
                        height={18}
                        paddingHorizontal={4}
                        borderRadius={999}
                        backgroundColor={palette.freshText}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text fontSize={11} fontWeight="800" color="#FFFFFF">
                          {pendingTasks}
                        </Text>
                      </YStack>
                    ) : null}
                  </YStack>
                </Animated.View>
              </Pressable>
              <Pressable
                onPress={onOpenSettings}
                testID="open-settings"
                onHoverIn={settingsHover.onHoverIn}
                onHoverOut={settingsHover.onHoverOut}
                onPressIn={settingsHover.onPressIn}
                onPressOut={settingsHover.onPressOut}
                accessibilityRole="button"
                accessibilityLabel="Réglages"
                style={pointerCursor}
              >
                <Animated.View style={{ transform: [{ scale: settingsHover.scale }] }}>
                  <YStack
                    width={44}
                    height={44}
                    borderRadius={999}
                    backgroundColor={palette.cream}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <SettingsIcon size={19} color={palette.ink} />
                  </YStack>
                </Animated.View>
              </Pressable>
              </XStack>
            </XStack>
      }
    >
          <TourAnchor id="hero">
          <Animated.View
            style={{
              opacity: entrance,
              transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              marginTop: 20,
            }}
          >
            {/* Two boxes, not one: the outer card carries the fill, radius
                and shadow and stays unpadded so `HeroWarmGlow` can fill it
                edge to edge; the padding lives on the inner content stack.
                With the padding on the glow's own parent, the gradient was
                measured against the content box and stopped 20pt short of
                the card on every side. */}
            <YStack
              backgroundColor={palette.brandDeep}
              overflow="hidden"
              style={{
                borderTopLeftRadius: 36,
                borderTopRightRadius: 20,
                borderBottomRightRadius: 36,
                borderBottomLeftRadius: 20,
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
                <Text fontSize={12} fontWeight="600" color={palette.brandDeepTextSecondary}>
                  AUJOURD’HUI DANS TON GARDE-MANGER
                </Text>
                <Text fontSize={24} fontWeight="800" color={palette.brandDeepText} lineHeight={30}>
                  {heroHeadline()}
                </Text>
                {failed ? (
                  <Text fontSize={13} fontWeight="500" color={palette.brandDeepTextSecondary}>
                    On n’a pas pu joindre le serveur.
                  </Text>
                ) : null}
                {empty ? (
                  <Text fontSize={13} fontWeight="500" color={palette.brandDeepTextSecondary}>
                    Ajoute un produit ou scanne un ticket de caisse pour démarrer.
                  </Text>
                ) : null}
                <XStack gap="$2" flexWrap="wrap">
                  {/* The pills are the two cards, restated — same windows, same
                      glyphs, same numbers. They used to carry `soonCount`, a
                      third window nothing else on the screen used. */}
                  {thisWeekCount > 0 ? (
                    <XStack alignItems="center" gap="$1.5" backgroundColor={palette.heroPillFill} paddingVertical="$1.5" paddingHorizontal="$3" borderRadius={999}>
                      <TriangleAlertIcon size={13} color={palette.soonOnDark} />
                      <Text fontSize={12} fontWeight="700" color={palette.soonOnDark}>
                        {thisWeekCount} cette semaine
                      </Text>
                    </XStack>
                  ) : null}
                  {expiredCount > 0 ? (
                    <XStack alignItems="center" gap="$1.5" backgroundColor={palette.heroPillFill} paddingVertical="$1.5" paddingHorizontal="$3" borderRadius={999}>
                      <CircleXIcon size={13} color={palette.expiredOnDark} />
                      <Text fontSize={12} fontWeight="700" color={palette.expiredOnDark}>
                        {expiredCount} dépassé{expiredCount > 1 ? 's' : ''}
                      </Text>
                    </XStack>
                  ) : null}
                  {failed ? (
                    <PillButton
                      testID="dashboard-retry"
                      label="Réessayer"
                      accessibilityLabel="Réessayer de charger le garde-manger"
                      onPress={() => productsQuery.refetch()}
                      palette={palette}
                    />
                  ) : null}
                </XStack>
              </YStack>
            </YStack>
          </Animated.View>
          </TourAnchor>

          {/* `alignItems="stretch"` stated rather than relied on: the three
              cards must end at the same baseline even when one label wraps. */}
          <TourAnchor id="stats">
          <XStack gap="$3" marginTop="$4" alignItems="stretch">
            <StatCard
              testID="dashboard-stat-week"
              bg={palette.cream}
              labelColor={palette.creamText}
              valueColor={palette.ink}
              chipColor={palette.chipOrange}
              icon={<TriangleAlertIcon size={18} color={palette.onDark} />}
              label="Cette semaine"
              value={metric(thisWeekCount)}
              corner="a"
              palette={palette}
              onPress={() => onOpenFridge('week')}
              accessibilityLabel={metricLabel('Cette semaine', thisWeekCount, 'produit')}
            />
            <StatCard
              testID="dashboard-stat-expired"
              bg={palette.lavender}
              labelColor={palette.lavenderText}
              valueColor={palette.ink}
              chipColor={palette.chipViolet}
              icon={<CircleXIcon size={18} color={palette.onDark} />}
              label="Dates dépassées"
              value={metric(expiredCount)}
              corner="b"
              palette={palette}
              onPress={() => onOpenFridge('expired')}
              accessibilityLabel={metricLabel('Dates dépassées', expiredCount, 'produit')}
            />
            <StatCard
              testID="dashboard-stat-to-buy"
              bg={palette.mintPale}
              labelColor={palette.mintPaleText}
              valueColor={palette.ink}
              chipColor={palette.chipTeal}
              icon={<ShoppingCartIcon size={18} color={palette.onDark} />}
              label="À racheter"
              value={shoppingQuery.isPending ? '—' : String(toBuyCount)}
              corner="c"
              palette={palette}
              onPress={onOpenCourses}
              accessibilityLabel={metricLabel('À racheter', toBuyCount, 'article', shoppingQuery.isPending)}
            />
          </XStack>
          </TourAnchor>

          <YStack marginTop="$6">
            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$2" flex={1}>
                {/* The garde-manger's own glyph, not a warning triangle: this
                    section lists what to cook first, it does not raise an alarm
                    about the food. The status pills below still carry the
                    warning glyphs, where the colour+icon+word rule wants them. */}
                <PackageIcon size={15} color={soonProducts.length > 0 ? palette.soon : palette.inkSecondary} />
                <Text fontSize={15} fontWeight="800" color={palette.ink}>
                  À consommer en premier
                </Text>
              </XStack>
              <Pressable
                // Wrapped, not passed: `onOpenFridge` now takes an expiry
                // window, and a bare handler would hand it the press event.
                onPress={() => onOpenFridge()}
                onHoverIn={seeAllHover.onHoverIn}
                onHoverOut={seeAllHover.onHoverOut}
                onPressIn={seeAllHover.onPressIn}
                onPressOut={seeAllHover.onPressOut}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                accessibilityRole="button"
                accessibilityLabel="Voir tout le garde-manger"
                style={pointerCursor}
              >
                <Animated.View style={{ transform: [{ scale: seeAllHover.scale }] }}>
                  <Text fontSize={12} fontWeight="700" color={palette.inkSecondary}>
                    Voir tout →
                  </Text>
                </Animated.View>
              </Pressable>
            </XStack>
            <YStack
              marginTop="$3"
              backgroundColor={palette.gradientBottom}
              borderRadius={20}
              padding="$2"
              gap="$1"
              style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 1 }}
            >
              {loading ? (
                <YStack padding="$2">
                  <SkeletonList rows={PREVIEW_COUNT} label="Chargement du garde-manger" palette={palette} />
                </YStack>
              ) : null}
              {failed ? (
                <Text fontSize={13} fontWeight="500" color={palette.expiredText} padding="$3">
                  Liste indisponible hors connexion.
                </Text>
              ) : null}
              {empty ? (
                <YStack padding="$3" gap="$3">
                  <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
                    Ajoute un produit, photographie ton frigo ou scanne un ticket pour démarrer.
                  </Text>
                  <XStack gap="$2" flexWrap="wrap">
                    <PillButton
                      label="Scanner"
                      onPress={goToScan}
                      testID="dashboard-empty-scan"
                      icon={(color) => <ScanLineIcon size={15} color={color} />}
                      palette={palette}
                    />
                    <PillButton
                      label="Ajouter un produit"
                      onPress={onAddProduct}
                      testID="dashboard-empty-add"
                      icon={(color) => <PlusIcon size={15} color={color} />}
                      tone="quiet"
                      palette={palette}
                    />
                  </XStack>
                </YStack>
              ) : null}
              {previewProducts.map((product) => (
                <PreviewRow
                  key={product.id}
                  product={product}
                  onPress={() => onOpenProduct(product.id)}
                  statusBg={statusBg}
                  statusText={statusText}
                  palette={palette}
                />
              ))}
            </YStack>
          </YStack>

          <YStack marginTop="$6">
            <XStack alignItems="center" gap="$2">
              <LayoutGridIcon size={15} color={palette.inkSecondary} />
              <Text fontSize={15} fontWeight="800" color={palette.ink}>
                Accès rapide
              </Text>
            </XStack>
            <YStack marginTop="$3">
              <ScanDraftBanner palette={palette} />
            </YStack>
            <TourAnchor id="navcards">
            <YStack gap="$3" marginTop="$3">
              <XStack gap="$3">
                <NavCard
                  bg={palette.navCardTeal}
                  glow={palette.chipTeal}
                  onPress={onOpenRecettes}
                  icon={<ChefHatIcon size={30} color={palette.onDark} />}
                  imageSource={potOfFoodIllustration}
                  title="Recettes"
                  subtitle={watchCount > 0 ? 'Cuisine ce qui part en premier' : 'Idées pour ce soir'}
                  corner="b"
                  palette={palette}
                />
                <NavCard
                  bg={palette.navCardViolet}
                  glow={palette.chipViolet}
                  onPress={onOpenCourses}
                  icon={<ShoppingCartIcon size={30} color={palette.onDark} />}
                  imageSource={shoppingCartIllustration}
                  title="Courses"
                  // No count here: the "À racheter" StatCard 200pt above already
                  // prints `toBuyCount` and already opens this exact destination.
                  // One question, one control.
                  subtitle={toBuyCount === 0 && !shoppingQuery.isPending ? 'Liste à jour' : 'Ce qu’il manque'}
                  corner="a"
                  palette={palette}
                />
              </XStack>
              <XStack gap="$3">
                <NavCard
                  bg={palette.navCardWarm}
                  glow={palette.chipOrange}
                  onPress={onOpenStats}
                  icon={<TrendingUpIcon size={30} color={palette.onDark} />}
                  imageSource={chartIncreasingIllustration}
                  title="Stats"
                  subtitle="Ton gaspi cette semaine"
                  corner="b"
                  palette={palette}
                />
                <NavCard
                  testID="dashboard-receipts"
                  bg={palette.navCardRose}
                  glow={palette.chipRose}
                  onPress={onOpenReceipts}
                  icon={<ReceiptIcon size={30} color={palette.onDark} />}
                  imageSource={receiptIllustration}
                  title="Tickets de caisse"
                  subtitle={receiptsQuery.isPending ? 'Chargement…' : receiptsSummary(receiptsQuery.data ?? [])}
                  corner="a"
                  palette={palette}
                  accessibilityLabel={
                    receiptsQuery.isPending
                      ? 'Tickets de caisse. Chargement'
                      : `Tickets de caisse. ${receiptsSummary(receiptsQuery.data ?? [])}`
                  }
                />
              </XStack>
            </YStack>
            </TourAnchor>
          </YStack>
    </AppShell>
    {/* The mobile bottom nav (glass pill + FAB) and the desktop sidebar are
        both AppShell's job now — see app-shell.tsx. Keeping them here,
        duplicated per screen, is exactly what left the FAB and persistent
        nav working on this screen only. */}
    {tour.show ? (
      <FirstRunTour
        scrollRef={scrollRef}
        scrollOffset={scrollOffset}
        onScan={goToScan}
        onFinish={tour.dismiss}
      />
    ) : null}
    </TourAnchorProvider>
  )
}

/**
 * The preview rows used to be inert text. They are the one place on the home
 * screen that names a specific product, so they are also the shortest route
 * to acting on it — each row opens that product.
 */
function PreviewRow({
  product,
  onPress,
  statusBg,
  statusText,
  palette,
}: {
  product: Product
  onPress: () => void
  statusBg: (status: ProductStatus) => string
  statusText: (status: ProductStatus) => string
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  const daysLeft = daysUntilExpiry(product)
  const status = statusOf(daysLeft)
  return (
    <Pressable
      testID={`dashboard-product-${product.id}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${product.name} — ${expiryLabel(daysLeft)}`}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack alignItems="center" gap="$3" padding="$2.5" minHeight={44}>
          <Text fontSize={13} fontWeight="600" color={palette.ink} flex={1} numberOfLines={1}>
            {product.name}
          </Text>
          <YStack alignItems="flex-end" gap="$1">
            <StatusChip status={status} bg={statusBg(status)} color={statusText(status)} />
            <Text fontSize={10} fontWeight="500" color={palette.inkSecondary}>
              {expiryLabel(daysLeft)}
            </Text>
          </YStack>
          <ChevronRightIcon size={16} color={palette.inkSecondary} />
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

/** An empty state that hands over the next action instead of describing the void. */
