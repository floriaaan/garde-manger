import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FlatList, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { Chip, CHIP_ICON_SIZE } from '../shared/chip.js'
import { ChipGroupSeparator } from '../shared/chip-group-separator.js'
import { PillButton } from '../shared/pill-button.js'
import { RecipeActionsSheet } from './recipe-actions-sheet.js'
import { useHint } from '../shared/hint-bubble.js'
import { pullToRefreshControl, usePullToRefresh } from '../shared/pull-to-refresh.js'
import { goToScan } from '../shared/scan-sheet.js'
import { SkeletonCard, SkeletonGroup } from '../shared/skeleton.js'
import { EmptyStateLottie } from '../shared/empty-state-lottie.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ArchiveIcon, StarIcon, ChefHatIcon, ClockIcon, SearchIcon, SparklesIcon, TagIcon } from '../dashboard/dashboard-icons.js'
import { FormField } from '../fridge/form-field.js'
import { CORNER_ROTATION, RecipeCard } from './recipe-card.js'
import { TonightRail } from './tonight-rail.js'
import { matchPantry, pickTonight } from './pantry-match.js'
import { provenanceLine } from './attribution.js'
import { daysUntilExpiry, expiryLabel, sortByExpiry } from '../dashboard/product-status.js'
import type { PantryMatch } from './pantry-match.js'
import { useRecipesQuery } from '../../application/recipe/recipes.query.js'
import { useDeleteRecipeMutation } from '../../application/recipe/delete-recipe.mutation.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import type { Recipe } from '../../domain/recipe/recipe.js'
import type { Product } from '../../domain/fridge/product.js'

/** Two budgets, because "vite fait" and "j'ai le temps" is the whole question a cook asks a clock. */
const TIME_BUDGETS = [15, 30] as const
type TimeBudget = (typeof TIME_BUDGETS)[number]

/** Past four, the tag row stops being a filter and becomes a second list to read. */
const MAX_TAG_FILTERS = 4

/**
 * The lead card leaves this much of the next one visible, so the rail declares
 * itself scrollable — but only when there *is* a next one. With a single
 * candidate the peek revealed nothing and left the hero 44pt short of the
 * search field and every library row, against dead ground.
 */
const RAIL_PEEK = 44

export function RecipeListScreen() {
  const palette = useSoftPalette()
  const [hint, showHint] = useHint()
  const [search, setSearch] = useState('')
  const [collection, setCollection] = useState<'active' | 'favorites' | 'archived'>('active')
  const [budget, setBudget] = useState<TimeBudget | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<Recipe | null>(null)
  /** The row is gone from the list the instant it is confirmed, and comes back if the server refuses. */
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const recipesQuery = useRecipesQuery()
  const productsQuery = useProductsQuery()
  // The foyer's members, to turn the ids a recipe carries into names. A failure
  // here costs a provenance line, never a recipe.
  const householdQuery = useHouseholdQuery()
  const sessionQuery = useSessionQuery()
  const deleteRecipe = useDeleteRecipeMutation()
  const recipes = useMemo(() => recipesQuery.data ?? [], [recipesQuery.data])
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])

  // Both queries: this screen's whole claim ("cette recette sauve tes
  // épinards") is a join between them, so refreshing one half would let the
  // two disagree.
  const refresh = usePullToRefresh(
    () => recipesQuery.refetch(),
    () => productsQuery.refetch(),
  )

  const nav = { kind: 'tab' as const, tab: 'recettes' as const, onScan: goToScan }
  // `contentWidth`, never the window: on desktop the sidebar and the pane's own
  // margin are not content, and a hero sized off the window overflowed its
  // column by 80pt at the 768pt breakpoint — invisibly, since a horizontal
  // ScrollView pushes rather than clips.
  const { isWide, hasMobileNav, contentWidth } = useAppShellLayout(nav)

  const tonight = useMemo(() => collection !== 'active' ? [] : pickTonight(recipes, products), [recipes, products, collection])
  const leadWidth = tonight.length > 1 ? Math.max(240, contentWidth - RAIL_PEEK) : contentWidth

  /**
   * The tags the foyer's own recipes actually carry, most common first — never
   * a fixed vocabulary. The generator invents these words; a hardcoded list
   * would filter on labels no recipe wears.
   */
  const tagFilters = useMemo(() => {
    const counts = new Map<string, number>()
    for (const recipe of recipes) {
      for (const value of recipe.tags) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_TAG_FILTERS)
      .map(([value]) => value)
  }, [recipes])

  const filtering = collection !== 'active' || search.trim().length > 0 || budget !== null || tag !== null

  const library = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return recipes
      .filter((recipe) => collection === 'archived' ? !!recipe.isArchived : !recipe.isArchived)
      .filter((recipe) => collection !== 'favorites' || recipe.isFavorite)
      .filter((recipe) => (budget === null ? true : recipe.preparationTime !== null && recipe.preparationTime <= budget))
      .filter((recipe) => (tag === null ? true : recipe.tags.includes(tag)))
      .filter((recipe) => (needle.length === 0 ? true : matchesSearch(recipe, needle)))
      .sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite) || b.createdAt.localeCompare(a.createdAt))
  }, [recipes, search, budget, tag, collection])

  /**
   * `null` rather than a zeroed match while the garde-manger is unknown: a row
   * claiming "0 sur 6 chez toi" because the products query has not answered yet
   * is a false statement about a shared fridge, not a loading state.
   */
  const pantryKnown = !productsQuery.isPending && !productsQuery.isError
  const matches = useMemo(() => {
    if (!pantryKnown) return new Map<string, PantryMatch>()
    return new Map(library.map((recipe) => [recipe.id, matchPantry(recipe, products)]))
  }, [library, products, pantryKnown])

  /**
   * Whether any visible row prints a count that is actually a guess.
   *
   * "Ce soir" carries its own disclosure, but that band only renders when
   * something is due this week — for most of the month the rows were the only
   * place the count appeared, and they stated it as fact. The gate is
   * `match.estimated`, not `total > 0`: `total` is `ingredients.length`, true
   * for every recipe, so the "conditional" disclosure was unconditional and
   * would have kept apologising for a count the backend had actually linked.
   */
  const showsPantryEstimate = useMemo(
    () => library.some((recipe) => matches.get(recipe.id)?.estimated ?? false),
    [library, matches],
  )

  /**
   * The product the empty state should name.
   *
   * First run is the one moment this app gets to prove it knows your fridge,
   * and the empty state said "à partir de ce qu'il faut finir en premier"
   * while holding the products in hand and naming none of them.
   */
  const firstToUse = useMemo(() => {
    if (!pantryKnown) return null
    const soonest = sortByExpiry(products).find((product) => {
      const days = daysUntilExpiry(product)
      return days !== null && days >= 0 && days <= 7
    })
    return soonest ?? null
  }, [products, pantryKnown])

  function openRecipe(recipeId: string) {
    router.push({ pathname: '/(tabs)/recipes/[id]', params: { id: recipeId } })
  }

  /**
   * Optimistic, because the row was the only feedback there was.
   *
   * The sheet used to close on an unawaited call: nothing spun, the row sat
   * there for the whole round trip, and a failure arrived as a toast that
   * erased itself in 3.2 seconds. On a library four people share, "I think I
   * deleted our recipe but it's still there" is a genuinely anxious wait. The
   * row now leaves immediately and **comes back** if the server refuses, with
   * the failure said in the row's own place rather than only in a toast.
   *
   * There is deliberately no undo: `FridgeConnector` exposes no way to recreate
   * a recipe, and an "Annuler" that cannot restore is worse than none. The
   * ActionSheet naming the consequence before the fact is the protection this
   * action actually has.
   */
  async function confirmDeletion() {
    const recipe = pendingDeletion
    setPendingDeletion(null)
    if (!recipe) return
    setDeletingId(recipe.id)
    const previous = queryClient.getQueryData<Recipe[]>(['recipes'])
    queryClient.setQueryData<Recipe[]>(['recipes'], (current) =>
      (current ?? []).filter((item) => item.id !== recipe.id),
    )
    const result = await deleteRecipe.mutateAsync(recipe.id)
    setDeletingId(null)
    if (result.ok) {
      showHint('Recette supprimée', 'success', { description: `« ${recipe.title} »` })
      return
    }
    // Put it back exactly where it was, then say so.
    if (previous) queryClient.setQueryData<Recipe[]>(['recipes'], previous)
    else await recipesQuery.refetch()
    showHint('Suppression impossible', 'error', { description: `« ${recipe.title} » est toujours là.` })
  }

  return (
    <>
      <AppShell
        nav={nav}
        scrollable={false}
        hint={hint}
        header={
          <YStack>
            <ScreenHeader
              palette={palette}
              icon={(color) => <ChefHatIcon size={19} color={color} />}
              title="Recettes"
              subtitle={recipesQuery.isPending ? undefined : `${recipes.length} recette${recipes.length > 1 ? 's' : ''}`}
              trailing={
                <PillButton
                  testID="recipes-generate"
                  label="Générer"
                  accessibilityLabel="Générer une recette"
                  onPress={() => router.push('/(tabs)/recipes/generate')}
                  palette={palette}
                  icon={(color) => <SparklesIcon size={15} color={color} />}
                />
              }
            />
            <LibraryFilters
              palette={palette}
              collection={collection}
              onCollectionChange={setCollection}
              search={search}
              onSearchChange={setSearch}
              budget={budget}
              onBudgetChange={setBudget}
              tag={tag}
              onTagChange={setTag}
              tagFilters={tagFilters}
            />
            {filtering ? (
              <ResultsCount palette={palette} count={library.length} />
            ) : null}
          </YStack>
        }
      >
        <FlatList
          // Without this, `contentContainerStyle`'s `flexGrow: 1` has no
          // parent height to grow into — the list stays shrink-wrapped to
          // its own content and the empty state never gets room to center.
          style={{ flex: 1 }}
          data={recipesQuery.isPending || recipesQuery.isError ? [] : library}
          keyExtractor={(recipe) => recipe.id}
          // The gap between rows belongs to the list, not to a wrapper View
          // allocated per row — and a virtualized list that knows nothing about
          // its own item height re-measures every row it windows in.
          ItemSeparatorComponent={RowGap}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews={false}
          renderItem={({ item, index }) => (
            <YStack>
              <RecipeCard
                recipe={item}
                match={matches.get(item.id) ?? null}
                palette={palette}
                corner={CORNER_ROTATION[index % CORNER_ROTATION.length]}
                provenance={provenanceLine(item, householdQuery.data, sessionQuery.data?.user.id)}
                deleting={deletingId === item.id}
                onPress={() => openRecipe(item.id)}
                onOpenActions={() => setPendingDeletion(item)}
              />
            </YStack>
          )}
          // `flexGrow: 1`: lets the empty state fill and vertically center in
          // the visible list area instead of pinning to the top — a no-op
          // once the list itself is taller than the screen.
          contentContainerStyle={{ ...shellContentStyle({ isWide, hasMobileNav }), paddingTop: 0, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={pullToRefreshControl(refresh, palette)}
          ListHeaderComponent={
            recipesQuery.isError ? null : (
              <YStack>
                {tonight.length > 0 ? (
                  <YStack marginBottom="$5">
                    <TonightRail candidates={tonight} palette={palette} leadWidth={leadWidth} onOpen={openRecipe} />
                  </YStack>
                ) : null}

                {/* The shortlist and every pantry count are a join with the
                    garde-manger. When that half cannot be read the screen used
                    to degrade in total silence — no band, no counts, no word —
                    and a diminished screen that says nothing is indistinguishable
                    from a foyer with nothing due. */}
                {productsQuery.isError ? (
                  <YStack marginBottom="$4" gap="$2" backgroundColor={palette.cream} padding="$4" borderRadius={18}>
                    <Text fontSize={13} fontWeight="700" color={palette.ink}>
                      Garde-manger indisponible
                    </Text>
                    <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} lineHeight={17}>
                      On ne peut pas dire ce que tu as sous la main — « Ce soir » et les compteurs d’ingrédients
                      attendent le garde-manger.
                    </Text>
                    <PillButton
                      testID="recipes-retry-products"
                      label="Réessayer"
                      accessibilityLabel="Réessayer de charger le garde-manger"
                      onPress={() => productsQuery.refetch()}
                      palette={palette}
                      tone="quiet"
                    />
                  </YStack>
                ) : null}

                {recipes.length > 0 ? (
                  <YStack gap="$1" marginBottom="$3">
                    <Text fontSize={20} fontWeight="800" color={palette.ink} role="heading">
                      {collection === 'archived' ? 'Archives' : collection === 'favorites' ? 'Favoris' : 'Toutes les recettes'}
                    </Text>
                    {showsPantryEstimate && tonight.length === 0 ? (
                      <Text fontSize={12} fontWeight="500" color={palette.inkSecondary}>
                        Disponibilité estimée d’après les noms des ingrédients.
                      </Text>
                    ) : null}
                  </YStack>
                ) : null}
              </YStack>
            )
          }
          ListEmptyComponent={
            recipesQuery.isPending ? (
              <SkeletonGroup label="Chargement des recettes">
                <SkeletonCard height={190} />
                <SkeletonCard height={96} />
                <SkeletonCard height={96} />
              </SkeletonGroup>
            ) : recipesQuery.isError ? (
              // Before emptiness, always: a failed read is not an empty
              // library, and telling a foyer it has no recipes because the
              // server did not answer is a confident false claim.
              <RecipesError palette={palette} onRetry={() => recipesQuery.refetch()} />
            ) : !search.trim() && budget === null && tag === null && (collection !== 'active' || recipes.some((recipe) => recipe.isArchived)) ? (
              <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$4">
                <Text fontSize={15} fontWeight="700" color={palette.ink} textAlign="center">
                  {collection === 'archived' ? 'Aucune recette archivée' : collection === 'favorites' ? 'Aucune recette favorite' : 'Tes recettes sont dans les archives'}
                </Text>
                <Text fontSize={13} color={palette.inkSecondary} textAlign="center">
                  {collection === 'favorites' ? 'Ajoute un favori depuis le menu d’une recette pour l’épingler ici.' : collection === 'archived' ? 'Les recettes que tu archives restent disponibles ici pour les désarchiver.' : 'Ouvre Archives pour les retrouver et les désarchiver.'}
                </Text>
                <PillButton centered label={collection === 'active' ? 'Voir les archives' : 'Voir les recettes'}
                  onPress={() => setCollection(collection === 'active' ? 'archived' : 'active')} palette={palette} />
              </YStack>
            ) : filtering ? (
              <NoMatches palette={palette} />
            ) : (
              <EmptyRecipes palette={palette} rescue={firstToUse} />
            )
          }
        />
      </AppShell>

      <RecipeActionsSheet
        visible={pendingDeletion !== null}
        recipe={pendingDeletion}
        onDelete={confirmDeletion}
        deleteTestID="recipe-delete-confirm"
        onFeedback={showHint}
        onClose={() => setPendingDeletion(null)}
      />
    </>
  )
}

/** The result count stays below the horizontal filters. */
function ResultsCount({ palette, count }: { palette: SoftPalette; count: number }) {
  return (
    <Text
      marginTop="$3"
      paddingBottom="$2"
      fontSize={12}
      fontWeight="700"
      color={palette.inkSecondary}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${count} recette${count > 1 ? 's' : ''} après filtrage`}
    >
      {count} résultat{count > 1 ? 's' : ''}
    </Text>
  )
}

/** The rhythm between library rows — `$3`, as a separator rather than a wrapper per row. */
function RowGap() {
  return <YStack height={12} />
}

/** A cook searching for "poulet" means the ingredient as often as the title. */
function matchesSearch(recipe: Recipe, needle: string): boolean {
  return (
    recipe.title.toLowerCase().includes(needle) ||
    (recipe.description?.toLowerCase().includes(needle) ?? false) ||
    recipe.tags.some((value) => value.toLowerCase().includes(needle)) ||
    recipe.ingredients.some((ingredient) => ingredient.label.toLowerCase().includes(needle))
  )
}

/** Search stays above one horizontal strip, with the collection first and the other filters separated. */
function LibraryFilters({
  collection,
  onCollectionChange,
  palette,
  search,
  onSearchChange,
  budget,
  onBudgetChange,
  tag,
  onTagChange,
  tagFilters,
}: {
  palette: SoftPalette
  search: string
  onSearchChange: (value: string) => void
  budget: TimeBudget | null
  onBudgetChange: (value: TimeBudget | null) => void
  tag: string | null
  onTagChange: (value: string | null) => void
  tagFilters: readonly string[]
  collection: 'active' | 'favorites' | 'archived'
  onCollectionChange: (value: 'active' | 'favorites' | 'archived') => void
}) {
  return (
    <YStack marginTop="$3">
      <FormField
        testID="recipes-search"
        label="Rechercher"
        value={search}
        onChangeText={onSearchChange}
        palette={palette}
        placeholder="Un titre ou un ingrédient"
        autoCapitalize="none"
        icon={(color) => <SearchIcon size={13} color={color} />}
      />

      {/* Collection, duration and tags are independent groups in the same strip. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingTop: 12, paddingBottom: 6, alignItems: 'center' }}
      >
        {(['active', 'favorites', 'archived'] as const).map((value) => <Chip
          key={value} testID={`recipes-collection-${value}`}
          label={value === 'active' ? 'Recettes' : value === 'favorites' ? 'Favoris' : 'Archives'}
          selected={collection === value} onPress={() => onCollectionChange(value)} palette={palette}
          tone={value === 'favorites' ? 'cream' : value === 'archived' ? 'lavender' : 'mint'}
          icon={(color) => value === 'favorites'
            ? <StarIcon size={CHIP_ICON_SIZE} color={color} />
            : value === 'archived' ? <ArchiveIcon size={CHIP_ICON_SIZE} color={color} />
            : <ChefHatIcon size={CHIP_ICON_SIZE} color={color} />}
        />)}
        <ChipGroupSeparator palette={palette} />

        {TIME_BUDGETS.map((minutes) => (
          <Chip
            key={minutes}
            testID={`recipes-budget-${minutes}`}
            label={`${minutes} min ou moins`}
            accessibilityLabel={`Temps de préparation : ${minutes} minutes ou moins`}
            selected={budget === minutes}
            onPress={() => onBudgetChange(budget === minutes ? null : minutes)}
            palette={palette}
            icon={(color) => <ClockIcon size={CHIP_ICON_SIZE} color={color} />}
          />
        ))}

        {tagFilters.length > 0 ? <ChipGroupSeparator palette={palette} /> : null}

        {tagFilters.map((value) => (
          <Chip
            key={value}
            testID={`recipes-tag-${value}`}
            label={value}
            accessibilityLabel={`Étiquette : ${value}`}
            selected={tag === value}
            onPress={() => onTagChange(tag === value ? null : value)}
            palette={palette}
            icon={(color) => <TagIcon size={CHIP_ICON_SIZE} color={color} />}
          />
        ))}
      </ScrollView>
    </YStack>
  )
}

/**
 * The list could not be read. Not "empty" — unknown, and the difference
 * matters on shared state: an empty library invites you to generate a recipe,
 * an unreadable one must invite you to try again, because generating would
 * fail against the same server.
 */
function RecipesError({ palette, onRetry }: { palette: SoftPalette; onRetry: () => void }) {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingHorizontal="$4">
      <ChefHatIcon size={30} color={palette.expiredText} />
      <Text fontSize={15} fontWeight="700" color={palette.ink}>
        Recettes indisponibles
      </Text>
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
        On n’a pas pu lire les recettes du foyer. Vérifie ta connexion.
      </Text>
      <PillButton
        testID="recipes-retry"
        label="Réessayer"
        accessibilityLabel="Réessayer de charger les recettes"
        onPress={onRetry}
        palette={palette}
        centered
      />
    </YStack>
  )
}

/** Empty filtered results retain a way to generate another recipe. */
function NoMatches({ palette }: { palette: SoftPalette }) {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingHorizontal="$4">
      <Text fontSize={14} fontWeight="700" color={palette.ink} textAlign="center">
        Aucune recette ne correspond
      </Text>
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
        Élargis la recherche depuis les filtres en haut, ou demande-en une nouvelle à partir de ce qu’il te reste.
      </Text>
      <PillButton
        testID="recipes-empty-generate"
        label="Générer une recette"
        onPress={() => router.push('/(tabs)/recipes/generate')}
        palette={palette}
        icon={(color) => <SparklesIcon size={15} color={color} />}
        centered
      />
    </YStack>
  )
}

function EmptyRecipes({ palette, rescue }: { palette: SoftPalette; rescue: Product | null }) {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingHorizontal="$4">
      <EmptyStateLottie animation="recipes" size={256} />
      <Text fontSize={15} fontWeight="700" color={palette.ink}>
        Aucune recette pour l’instant
      </Text>
      {/* Naming the product is the whole difference between this app's empty
          state and a recipe app's. It is only ever printed from a garde-manger
          that answered — never from a fixture, never as a guess. */}
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
        {rescue
          ? `Tu as des ${rescue.name.toLowerCase()} à finir — ${expiryLabel(daysUntilExpiry(rescue)).toLowerCase()}. Demande une recette autour, ça prend quelques secondes.`
          : 'Demande-en une à partir de ce qu’il faut finir en premier — ça prend quelques secondes.'}
      </Text>
      {/* The action inside the empty state, not only in the header the user has
          already read past. */}
      <PillButton
        testID="recipes-empty-generate"
        label="Générer une recette"
        onPress={() => router.push('/(tabs)/recipes/generate')}
        palette={palette}
        icon={(color) => <SparklesIcon size={15} color={color} />}
        centered
      />
    </YStack>
  )
}
