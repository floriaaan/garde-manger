import { t, useTranslation } from '../../i18n/index.js'
import { useMemo, useState } from 'react'
import { ScrollView, SectionList } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { AppShell, useAppShellLayout } from '../shared/app-shell.js'
import { Chip, CHIP_ICON_SIZE } from '../shared/chip.js'
import { ChipGroupSeparator } from '../shared/chip-group-separator.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { pullToRefreshControl, usePullToRefresh } from '../shared/pull-to-refresh.js'
import { SkeletonList } from '../shared/skeleton.js'
import { goToScan } from '../shared/scan-sheet.js'
import { PillButton } from '../shared/pill-button.js'
import { ProductExitSheet } from './product-exit-sheet.js'
import { useHint } from '../shared/hint-bubble.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import {
  EXPIRY_WINDOWS,
  EXPIRY_WINDOW_LABELS,
  daysUntilExpiry,
  expiryLabel,
  matchesExpiryWindow,
  sortByExpiry,
  statusOf,
} from '../dashboard/product-status.js'
import type { ExpiryWindow } from '../dashboard/product-status.js'
import {
  ArchiveIcon,
  CircleXIcon,
  LayersIcon,
  PlusIcon,
  RefrigeratorIcon,
  SearchIcon,
  SnowflakeIcon,
  TriangleAlertIcon,
  XIcon,
} from '../dashboard/dashboard-icons.js'
import { FridgeCabinet, ShelfHeader, ShelfRail } from './fridge-cabinet.js'
import { FormField } from './form-field.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { useDeleteProductMutation } from '../../application/fridge/delete-product.mutation.js'
import { useRecordProductOutcomeMutation } from '../../application/fridge/record-product-outcome.mutation.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { Product } from '../../domain/fridge/product.js'
import type { DiscardReason } from '../../domain/fridge/product-outcome.js'

const FILTER_LABELS: Record<LocationValue, string> = { get fridge() { return t('fridge.fridge') }, get freezer() { return t('fridge.freezer') }, get pantry() { return t('fridge.cupboard') } }

/** One glyph per compartment, shared by the filter chips and the shelf headers. */
const LOCATION_ICONS: Record<LocationValue, (size: number, color: string) => React.ReactNode> = {
  fridge: (size, color) => <RefrigeratorIcon size={size} color={color} />,
  freezer: (size, color) => <SnowflakeIcon size={size} color={color} />,
  pantry: (size, color) => <ArchiveIcon size={size} color={color} />,
}

// Exported for direct unit testing of the badge thresholds — see fridge-list-screen.test.tsx.
// Both read the app-wide definition in product-status.ts: this screen used to
// carry its own fractional-day copy, so a product due today was "À consommer
// vite" here and "Dépassé" on the dashboard.
export function isExpired(product: Product): boolean {
  return statusOf(daysUntilExpiry(product)) === 'expired'
}

export function isExpiringSoon(product: Product, withinDays = 3): boolean {
  const days = daysUntilExpiry(product)
  return days !== null && days >= 0 && days <= withinDays
}

/**
 * A product sitting on a shelf: its own light surface, lifted off the glass by
 * a soft shadow rather than separated from it by a rule.
 */
function ProductRow({
  product,
  palette,
  selecting,
  selected,
  onToggleSelect,
  onStartSelecting,
}: {
  product: Product
  palette: SoftPalette
  selecting: boolean
  selected: boolean
  onToggleSelect: () => void
  onStartSelecting: () => void
}) {
  const { t } = useTranslation()
  const hover = useHoverPress()
  return (
    <Pressable
      testID={`fridge-product-${product.id}`}
      // In selection mode a tap selects instead of navigating: a mode whose
      // primary gesture still does the old thing is not a mode, it is a trap.
      onPress={
        selecting ? onToggleSelect : () => router.push({ pathname: '/(tabs)/fridge/[id]', params: { id: product.id } })
      }
      // Long press, not a swipe — the same non-gesture path the shopping list
      // already establishes, and the one a screen reader and a mouse can both
      // reach.
      onLongPress={selecting ? onToggleSelect : onStartSelecting}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      // React Native collapses this Pressable's children into one label, so
      // the name alone silenced the quantity, the expiry and the badge — the
      // screen's entire job, inaudible. Same sentence the dashboard's
      // `PreviewRow` already announces.
      accessibilityLabel={`${product.name}, ${product.quantity.amount} ${product.quantity.unit}, ${expiryLabel(daysUntilExpiry(product))}`}
      style={pointerCursor}
    >
      <XStack
        backgroundColor={selected ? palette.accentLime : palette.cabinetRowSurface}
        borderRadius={14}
        padding="$3"
        marginHorizontal="$2"
        marginBottom="$2"
        alignItems="center"
        gap="$3"
        style={{
          shadowColor: palette.shadowCool,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 1,
        }}
      >
        <YStack flex={1}>
          <Text fontSize={14} fontWeight="700" color={selected ? palette.accentLimeText : palette.cabinetInk}>
            {product.name}
          </Text>
          <Text fontSize={12} color={selected ? palette.accentLimeText : palette.cabinetInkSecondary}>
            {product.quantity.amount} {product.quantity.unit} · {expiryLabel(daysUntilExpiry(product))}
          </Text>
        </YStack>
        {isExpired(product) ? (
          <XStack backgroundColor={palette.expiredBg} borderRadius={999} paddingVertical="$1" paddingHorizontal="$2.5">
            <Text fontSize={11} fontWeight="700" color={palette.expiredText}>{t('dashboard.past_expiry_2')}</Text>
          </XStack>
        ) : isExpiringSoon(product) ? (
          <XStack backgroundColor={palette.soonBg} borderRadius={999} paddingVertical="$1" paddingHorizontal="$2.5">
            <Text fontSize={11} fontWeight="700" color={palette.soonText}>{t('fridge.use_soon')}</Text>
          </XStack>
        ) : null}
      </XStack>
    </Pressable>
  )
}

/** The "+ Ajouter" pill, with a drawn plus rather than a typed `+`. */
function AddProductButton({ palette, testID }: { palette: SoftPalette; testID: string }) {
  const { t } = useTranslation()
  return (
    <PillButton
      testID={testID}
      label={t('fridge.add')}
      accessibilityLabel={t('dashboard.add_a_product')}
      onPress={() => router.push('/(tabs)/fridge/new')}
      palette={palette}
      icon={(color) => <PlusIcon size={15} color={color} />}
    />
  )
}

/** The glyph each window already wears on the dashboard card that links here. */
const WINDOW_ICONS: Record<ExpiryWindow, (size: number, color: string) => React.ReactNode> = {
  week: (size, color) => <TriangleAlertIcon size={size} color={color} />,
  expired: (size, color) => <CircleXIcon size={size} color={color} />,
}

/**
 * The pinned header while a selection is open.
 *
 * It replaces the title block rather than sitting under it, because a mode
 * needs to look like one: the search field and the compartment chips steer a
 * list you are browsing, and they are not what you are doing right now.
 *
 * This exists because the app had exactly one way for a product to leave the
 * fridge — the detail screen's destructive sheet, one product at a time. A
 * foyer that cooked the recipe the app wrote them still had to open, confirm
 * and dismiss three times to say so, and "Dates dépassées: 6" was a link to
 * eighteen interactions. The count on the home screen could only ever go up,
 * which turns a tool into an accusation.
 */
function SelectionBar({
  count,
  onCancel,
  onRemove,
  palette,
}: {
  count: number
  onCancel: () => void
  onRemove: () => void
  palette: SoftPalette
}) {
  const { t } = useTranslation()
  return (
    <XStack alignItems="center" gap="$3" minHeight={44}>
      <Pressable
        testID="fridge-selection-cancel"
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('fridge.exit_selection')}
        style={pointerCursor}
      >
        <YStack width={44} height={44} borderRadius={999} backgroundColor={palette.cream} alignItems="center" justifyContent="center">
          <XIcon size={18} color={palette.ink} />
        </YStack>
      </Pressable>
      <Text fontSize={16} fontWeight="800" color={palette.ink} flex={1} numberOfLines={1}>{t('fridge.product_selected', { count: count })}</Text>
      <Pressable
        testID="fridge-selection-remove"
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t('fridge.remove_product', { count: count })}
        style={pointerCursor}
      >
        <XStack
          alignItems="center"
          gap="$1.5"
          minHeight={44}
          paddingHorizontal="$3"
          borderRadius={999}
          backgroundColor={palette.expiredBg}
        >
          <Text fontSize={13} fontWeight="800" color={palette.expiredText}>{t('fridge.remove')}</Text>
        </XStack>
      </Pressable>
    </XStack>
  )
}

/**
 * Everything above the cabinet: the screen title, the add action, the search
 * field and the compartment filters. It sits outside the frame on purpose —
 * these are controls for looking into the fridge, not things inside it.
 */
function FridgeListHeader({
  palette,
  locationFilter,
  onFilterChange,
  search,
  onSearchChange,
  count,
  expiryWindow,
  onExpiryWindowChange,
}: {
  palette: SoftPalette
  locationFilter: LocationValue | null
  onFilterChange: (filter: LocationValue | null) => void
  search: string
  onSearchChange: (value: string) => void
  count: number
  expiryWindow: ExpiryWindow | null
  onExpiryWindowChange: (window: ExpiryWindow | null) => void
}) {
  const { t } = useTranslation()
  return (
    <YStack>
      <ScreenHeader
        palette={palette}
        // The enamel tint, not cream: the header's glyph is the cabinet it sits above.
        tint={palette.cabinetEnamel}
        icon={(color) => <RefrigeratorIcon size={19} color={color} />}
        title={t('fridge.pantry')}
        subtitle={
          expiryWindow
            ? t('fridge.product_3', { count: count, value2: EXPIRY_WINDOW_LABELS[expiryWindow].toLowerCase() })
            : t('fridge.product_grouped_by_location', { count: count })
        }
        trailing={<AddProductButton palette={palette} testID="fridge-add" />}
      />

      <YStack marginTop="$3">
        <FormField
          testID="fridge-search"
          label={t('fridge.search')}
          value={search}
          onChangeText={onSearchChange}
          palette={palette}
          placeholder={t('fridge.a_product_name')}
          autoCapitalize="none"
          icon={(color) => <SearchIcon size={13} color={color} />}
        />
      </YStack>

      {/* One horizontally scrollable line for both axes. It was already
          scrollable because four compartment chips overflowed below ~340pt and
          "Congélateur" fell off the row; the two expiry windows join it rather
          than opening a second permanent row, and the scroll is what pays for
          them. The windows come first so one arrived at from a dashboard card
          is selected *and* visible without scrolling. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 12, alignItems: 'center' }}
      >
        {EXPIRY_WINDOWS.map((window) => (
          <Chip
            key={window}
            testID={`fridge-window-${window}`}
            label={EXPIRY_WINDOW_LABELS[window]}
            // A window is a toggle, not one option of a set: pressing the
            // selected one clears it. That is the way out of a filter the
            // dashboard opened, and it is why this axis needs no "Tout" of its
            // own next to the compartments'.
            selected={expiryWindow === window}
            onPress={() => onExpiryWindowChange(expiryWindow === window ? null : window)}
            palette={palette}
            icon={(color) => WINDOW_ICONS[window](CHIP_ICON_SIZE, color)}
          />
        ))}

        <ChipGroupSeparator palette={palette} />

        <Chip
          testID="fridge-filter-all"
          label={t('fridge.all')}
          selected={locationFilter === null}
          onPress={() => onFilterChange(null)}
          palette={palette}
          icon={(color) => <LayersIcon size={CHIP_ICON_SIZE} color={color} />}
        />
        {LOCATIONS.map((location) => (
          <Chip
            key={location}
            testID={`fridge-filter-${location}`}
            label={FILTER_LABELS[location]}
            selected={locationFilter === location}
            onPress={() => onFilterChange(location)}
            palette={palette}
            icon={(color) => LOCATION_ICONS[location](CHIP_ICON_SIZE, color)}
          />
        ))}
      </ScrollView>
    </YStack>
  )
}

/**
 * `expiryWindow` is a prop, not state read from the URL in here: the route
 * owns it (`app/(tabs)/fridge/index.tsx`), the same way the dashboard takes
 * its navigation as callbacks. Copying it into `useState` would have looked
 * fine and been wrong — a second tap on a dashboard card lands on an
 * already-mounted screen, and an initial value never runs twice.
 */
export function FridgeListScreen({
  expiryWindow = null,
  onExpiryWindowChange = () => {},
}: {
  expiryWindow?: ExpiryWindow | null
  onExpiryWindowChange?: (window: ExpiryWindow | null) => void
} = {}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const [locationFilter, setLocationFilter] = useState<LocationValue | null>(null)
  const [search, setSearch] = useState('')
  const products = useProductsQuery(locationFilter ? { location: locationFilter } : undefined)
  const deleteProduct = useDeleteProductMutation()
  const recordOutcome = useRecordProductOutcomeMutation()
  const [hint, showHint] = useHint()
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const [exiting, setExiting] = useState(false)
  const selecting = selectedIds.length > 0
  const nav = { kind: 'tab' as const, tab: 'frigo' as const, onScan: goToScan }
  const { isWide, hasMobileNav } = useAppShellLayout(nav)
  const refresh = usePullToRefresh(() => products.refetch())

  /**
   * One section per compartment, in the order the compartments physically
   * are — never reordered by urgency, because a shelf is a place. Sorting by
   * soonest expiry is preserved *inside* each shelf, which is what answers
   * "what do I cook off this shelf tonight"; the global answer stays on the
   * dashboard's hero and its "À consommer en premier" list. Empty shelves are dropped
   * rather than shown empty — a fridge with no freezer contents shows no
   * freezer shelf, not a labelled void.
   */
  const sections = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const all = products.data ?? []
    const inWindow = expiryWindow
      ? all.filter((product) => matchesExpiryWindow(daysUntilExpiry(product), expiryWindow))
      : all
    const matching =
      needle.length > 0 ? inWindow.filter((product) => product.name.toLowerCase().includes(needle)) : inWindow
    return LOCATIONS.map((location) => ({
      location,
      title: FILTER_LABELS[location],
      data: sortByExpiry(matching.filter((product) => product.location === location)),
    })).filter((section) => section.data.length > 0)
  }, [products.data, search, expiryWindow])

  const visibleCount = sections.reduce((total, section) => total + section.data.length, 0)
  const isEmpty = sections.length === 0

  function toggleSelected(productId: string) {
    setSelectedIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    )
  }

  type Exit = { kind: 'consumed' } | { kind: 'discarded'; discardReason: DiscardReason | null } | { kind: 'correction' }

  async function handleExitSelected(exit: Exit) {
    const ids = selectedIds
    setExiting(false)
    setSelectedIds([])
    // Sequential, not `Promise.all`: the connector talks to one household's
    // API, and a partial failure has to name how far it got rather than
    // scatter N simultaneous errors.
    const failures: string[] = []
    for (const id of ids) {
      const result =
        exit.kind === 'correction'
          ? await deleteProduct.mutateAsync(id)
          : await recordOutcome.mutateAsync({
              productId: id,
              input:
                exit.kind === 'discarded'
                  ? { kind: 'discarded', discardReason: exit.discardReason }
                  : { kind: 'consumed' },
            })
      if (!result.ok) failures.push(id)
    }
    await products.refetch()
    if (failures.length > 0) {
      showHint(t('fridge.product_couldn_t_be_removed', { count: failures.length }), 'error')
    }
  }

  const selectedProducts = (products.data ?? []).filter((product) => selectedIds.includes(product.id))

  return (
    <>
      <AppShell
        nav={nav}
        scrollable={false}
        // The search field and the compartment filters ride with the title in
        // the pinned block: they are how you steer the list, so scrolling the
        // list must not take them away.
        hint={hint}
        header={
          selecting ? (
            <SelectionBar
              count={selectedIds.length}
              onCancel={() => setSelectedIds([])}
              onRemove={() => setExiting(true)}
              palette={palette}
            />
          ) : (
            <FridgeListHeader
              palette={palette}
              locationFilter={locationFilter}
              onFilterChange={setLocationFilter}
              search={search}
              onSearchChange={setSearch}
              count={visibleCount}
              expiryWindow={expiryWindow}
              onExpiryWindowChange={onExpiryWindowChange}
            />
          )
        }
      >
        {/* The shell's own padding recipe, applied to a fixed column rather
            than a scroll container: the cabinet is a frame that stays put
            while its contents scroll inside it. */}
        <YStack
          flex={1}
          minHeight={0}
          paddingHorizontal={20}
          paddingTop={4}
          paddingBottom={hasMobileNav ? 96 : 20}
          width={isWide ? '100%' : undefined}
          maxWidth={isWide ? 640 : undefined}
          alignSelf={isWide ? 'center' : undefined}
        >
          <FridgeCabinet palette={palette}>
            {/* Virtualized (SectionList), not ScrollView + .map — an audit
                flagged the household product list as an unbounded-growth
                performance risk, and grouping it into shelves must not undo
                that. */}
            <SectionList
              // flex + minHeight:0, per DESIGN.md's rule for every flex box in a
              // chain that ends in a scroll container: without it the list sizes
              // to its content and overflows the cabinet instead of scrolling
              // inside it.
              style={{ flex: 1, minHeight: 0 }}
              sections={sections}
              keyExtractor={(product) => product.id}
              renderItem={({ item }) => (
                <ProductRow
                  product={item}
                  palette={palette}
                  selecting={selecting}
                  selected={selectedIds.includes(item.id)}
                  onToggleSelect={() => toggleSelected(item.id)}
                  onStartSelecting={() => setSelectedIds([item.id])}
                />
              )}
              renderSectionHeader={({ section }) => (
                <ShelfHeader
                  palette={palette}
                  icon={LOCATION_ICONS[section.location](14, palette.cabinetInkSecondary)}
                  label={section.title}
                  count={section.data.length}
                />
              )}
              renderSectionFooter={() => <ShelfRail palette={palette} />}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              refreshControl={pullToRefreshControl(refresh, palette)}
              ListEmptyComponent={
                products.isPending ? (
                  <YStack padding="$3">
                    <SkeletonList rows={4} label={t('dashboard.loading_pantry')} palette={palette} />
                  </YStack>
                ) : products.isError ? (
                  // Before `isEmpty`, and this order is the whole fix: a failed
                  // read used to fall through to the empty state and tell a
                  // foyer its shared fridge held nothing. Every other list
                  // screen already branched on `isError`; this one — the one
                  // opened standing at the fridge door on bad wifi — did not.
                  <CabinetError palette={palette} onRetry={() => products.refetch()} />
                ) : isEmpty ? (
                  <EmptyFridge search={search} palette={palette} />
                ) : null
              }
            />
          </FridgeCabinet>
        </YStack>
      </AppShell>
      <ProductExitSheet
        visible={exiting}
        products={selectedProducts}
        onClose={() => setExiting(false)}
        onConsumed={() => handleExitSelected({ kind: 'consumed' })}
        onDiscarded={({ discardReason }) => handleExitSelected({ kind: 'discarded', discardReason })}
        onCorrection={() => handleExitSelected({ kind: 'correction' })}
      />
    </>
  )
}

/**
 * The cabinet could not be read. Not "empty" — unknown.
 *
 * The distinction is not pedantry on shared state: an empty fridge invites you
 * to fill it, and an unreadable one must invite you to try again. Offering
 * "Scanne un code-barres" to someone whose request just failed sends them to
 * add a product the app cannot save either.
 */
function CabinetError({ palette, onRetry }: { palette: SoftPalette; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <YStack gap="$3" marginTop="$8" paddingHorizontal="$4" alignItems="center">
      <RefrigeratorIcon size={30} color={palette.expiredText} />
      <Text fontSize={15} fontWeight="700" color={palette.cabinetInk}>{t('dashboard.pantry_unavailable')}</Text>
      <Text fontSize={13} fontWeight="500" color={palette.cabinetInkSecondary} textAlign="center">{t('fridge.we_couldn_t_load_the_household_s_pantry_check_your')}</Text>
      <PillButton
        testID="fridge-retry"
        label={t('dashboard.try_again')}
        accessibilityLabel={t('dashboard.try_loading_the_pantry_again')}
        onPress={onRetry}
        palette={palette}
        centered
      />
    </YStack>
  )
}

function EmptyFridge({ search, palette }: { search: string; palette: SoftPalette }) {
  const { t } = useTranslation()
  if (search.trim().length > 0) {
    return (
      <Text fontSize={13} color={palette.cabinetInkSecondary} margin="$4">{t('fridge.no_product_matches', { value1: search.trim() })}</Text>
    )
  }
  return (
    <YStack gap="$3" marginTop="$8" paddingHorizontal="$4" alignItems="center">
      <RefrigeratorIcon size={30} color={palette.cabinetInkSecondary} />
      <Text fontSize={15} fontWeight="700" color={palette.cabinetInk}>{t('fridge.the_shelves_are_empty')}</Text>
      <Text fontSize={13} fontWeight="500" color={palette.cabinetInkSecondary} textAlign="center">{t('fridge.scan_a_barcode_or_receipt_to_fill_your_pantry_without')}</Text>
      <PillButton
        testID="fridge-empty-add"
        label={t('dashboard.add_a_product')}
        onPress={() => router.push('/(tabs)/fridge/new')}
        palette={palette}
        icon={(color) => <PlusIcon size={15} color={color} />}
        centered
      />
    </YStack>
  )
}
