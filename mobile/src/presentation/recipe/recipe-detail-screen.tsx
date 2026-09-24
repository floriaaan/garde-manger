/*
 * DIRECTION CONTRACT — recipe detail (2026-09-05)
 *
 * Same world as the rest of the app: mint blob ground, one warm-mocha
 * high-contrast block (here the title header, playing the hero role),
 * pastel cards, asymmetric radii, lime reserved for the one primary action.
 *
 * WHY IT EXISTS: the Recettes tab used to end in a "bientôt disponible"
 * toast — the product's headline job ("quoi cuisiner ce soir") was
 * unreachable. This screen answers it, and the ingredient split below is
 * the whole point of answering it inside a fridge app rather than a recipe
 * app: the backend links an ingredient to a real product when the foyer
 * already owns it, so the screen can say what you have and what is
 * missing, then push the missing half onto the shopping list in one tap.
 */
import { useState } from 'react'
import { Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { Skeleton, SkeletonGroup, SkeletonRow } from '../shared/skeleton.js'
import { useHint } from '../shared/hint-bubble.js'
import { useSoftPalette, type SoftPalette } from '../dashboard/soft-palette.js'
import { BanIcon, ChefHatIcon, ChevronRightIcon, CircleCheckIcon, EllipsisIcon, ShoppingCartIcon } from '../dashboard/dashboard-icons.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { useDeleteRecipeMutation } from '../../application/recipe/delete-recipe.mutation.js'
import { useRecipeQuery } from '../../application/recipe/recipe.query.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useCookRecipeMutation } from '../../application/recipe/cook-recipe.mutation.js'
import { provenanceLine } from './attribution.js'
import { matchPantry, splitIngredients } from './pantry-match.js'
import { useCreateShoppingItemMutation } from '../../application/shopping-list/create-shopping-item.mutation.js'
import { goBack } from '../shared/navigation.js'
import type { Recipe, RecipeIngredient } from '../../domain/recipe/recipe.js'

/** Instructions arrive as one string; the numbered prefixes are the author's, not ours. */
function steps(instructions: string): string[] {
  return instructions
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 0)
}

function ingredientLine(ingredient: RecipeIngredient): string {
  if (ingredient.quantity === null) return ingredient.label
  return `${ingredient.label} — ${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ''}`
}

export function RecipeDetailScreen({ recipeId }: { recipeId: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const recipe = useRecipeQuery(recipeId)
  // Both queries, and both wired into the refresh: this screen's ingredient
  // split is a join between them, so refreshing one half would let the two
  // disagree — the same rule the list screen follows.
  const productsQuery = useProductsQuery()
  const householdQuery = useHouseholdQuery()
  const sessionQuery = useSessionQuery()
  const cookRecipe = useCookRecipeMutation()
  const refresh = usePullToRefresh(
    () => recipe.refetch(),
    () => productsQuery.refetch(),
  )
  const createItem = useCreateShoppingItemMutation()
  const [hint, showHint] = useHint()
  const [adding, setAdding] = useState(false)
  const [confirmingDeletion, setConfirmingDeletion] = useState(false)
  const [confirmingCook, setConfirmingCook] = useState(false)
  const [cooking, setCooking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteRecipe = useDeleteRecipeMutation()

  /**
   * Deleting lives here too, not only on the list.
   *
   * "On en a fini avec celle-là" is a verdict you reach after reading the
   * recipe, and this was the one screen where you could reach it and not act on
   * it — the decision was on the previous screen, behind a control you had to
   * scroll back to find. Same ActionSheet, same consequence named, so the two
   * entrances confirm identically.
   */
  // This screen is `(tabs)/recipes/[id]`, pushed onto the Recettes tab's own
  // nested stack — not a top-level route. On iOS that means the real
  // `NativeTabs` bar (owned by `(tabs)/_layout.tsx`, entirely outside this
  // component) stays on screen through the push; `kind: 'stack'` alone told
  // `AppShell` no bottom chrome existed here, so it gave the toast a bottom
  // offset tuned for "nothing there" and the pill rendered under the bar.
  const nav = { kind: 'stack' as const, insideTabs: true }

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <ChefHatIcon size={19} color={color} />}
      title="Recette"
      onBack={() => goBack('/(tabs)/recipes')}
      trailing={
        recipe.data ? (
          <Pressable
            testID="recipe-detail-actions"
            disabled={deleting}
            onPress={() => setConfirmingDeletion(true)}
            accessibilityRole="button"
            accessibilityLabel={`Actions pour « ${recipe.data.title} »`}
            style={[pointerCursor, { padding: 10 }]}
          >
            <YStack width={28} height={28} alignItems="center" justifyContent="center">
              <EllipsisIcon size={16} color={palette.inkSecondary} />
            </YStack>
          </Pressable>
        ) : undefined
      }
    />
  )

  async function confirmDeletion() {
    const data = recipe.data
    setConfirmingDeletion(false)
    if (!data) return
    setDeleting(true)
    const result = await deleteRecipe.mutateAsync(data.id)
    setDeleting(false)
    if (!result.ok) {
      showHint(`« ${data.title} » n’a pas pu être supprimée — elle est toujours là.`, 'error')
      return
    }
    // The list is what the user lands back on, so it must not still show the row.
    queryClient.setQueryData<Recipe[]>(['recipes'], (current) =>
      (current ?? []).filter((item) => item.id !== data.id),
    )
    goBack('/(tabs)/recipes')
  }

  const deletionSheet = (
    <ActionSheet
      visible={confirmingDeletion}
      title={recipe.data ? `Supprimer « ${recipe.data.title} » ?` : ''}
      description="Elle disparaît aussi pour les autres membres du foyer, et c’est définitif."
      options={[
        {
          testID: 'recipe-detail-delete-confirm',
          label: 'Supprimer la recette',
          icon: (color) => <BanIcon size={18} color={color} />,
          tint: palette.expiredBg,
          destructive: true,
          onPress: confirmDeletion,
        },
      ]}
      onClose={() => setConfirmingDeletion(false)}
    />
  )

  if (recipe.isPending) {
    return (
      <AppShell nav={nav} refresh={refresh} header={header}>
        <SkeletonGroup label="Chargement de la recette">
          <Skeleton width="70%" height={22} />
          <Skeleton width="40%" height={13} />
          <YStack marginTop="$4" gap="$2">
            <Skeleton height={12} />
            <Skeleton height={12} />
            <Skeleton width="80%" height={12} />
          </YStack>
          <YStack marginTop="$4" gap="$1">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </YStack>
        </SkeletonGroup>
      </AppShell>
    )
  }

  if (!recipe.data) {
    return (
      <AppShell nav={nav} refresh={refresh} header={header}>
        <YStack marginTop="$5" gap="$3">
          <Text fontSize={14} color={palette.inkSecondary}>
            Recette introuvable.
          </Text>
          {recipe.isError ? (
            <Pressable
              testID="recipe-detail-retry"
              onPress={() => recipe.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Réessayer"
              style={pointerCursor}
            >
              <XStack
                alignSelf="flex-start"
                backgroundColor={palette.accentLime}
                borderRadius={999}
                paddingHorizontal="$4"
                minHeight={44}
                alignItems="center"
              >
                <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
                  Réessayer
                </Text>
              </XStack>
            </Pressable>
          ) : null}
        </YStack>
      </AppShell>
    )
  }

  const data = recipe.data
  /**
   * The same join the list card printed, not a second opinion.
   *
   * This screen used to split on `ingredient.productId !== null`, which
   * `recipe-draft-parser.ts` sets to `null` on every AI-generated ingredient —
   * i.e. all of them. So "Déjà dans ton garde-manger" never rendered, "À
   * prévoir" always held everything, and the screen offered to buy back what
   * the previous screen had just said the foyer owned. `null` while the
   * garde-manger is unknown, never a zeroed match: an empty owned list because
   * a query has not answered is a false statement about a shared fridge.
   */
  const pantryKnown = !productsQuery.isPending && !productsQuery.isError
  const match = pantryKnown ? matchPantry(data, productsQuery.data ?? []) : null
  const { owned, missing } = match
    ? splitIngredients(data, match)
    : { owned: [], missing: data.ingredients }
  const preparation = steps(data.instructions)
  const provenance = provenanceLine(data, householdQuery.data, sessionQuery.data?.user.id)

  /**
   * Consuming is what makes the loop close, and it is destructive on shared
   * state — so it is confirmed by the same ActionSheet as deletion, naming
   * exactly what leaves the fridge. Nothing to consume is still worth
   * recording: "on l'a refaite" is a fact about the recipe.
   */
  async function confirmCooked() {
    const data = recipe.data
    setConfirmingCook(false)
    if (!data) return
    setCooking(true)
    const productIds = match ? owned.map((i) => match.byIngredient.get(i.id)?.id).filter((id): id is string => !!id) : []
    const result = await cookRecipe.mutateAsync({ recipeId: data.id, productIds })
    setCooking(false)
    if (!result.ok) {
      showHint('On n’a pas pu enregistrer — rien n’a bougé dans le garde-manger.', 'error')
      return
    }
    // The garde-manger changed, so every screen that reads it is now stale:
    // the dashboard's counts, the fridge list, and "Ce soir" itself.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['recipes'] }),
      recipe.refetch(),
    ])
    showHint(
      productIds.length > 0
        ? `C’est noté — ${productIds.length} produit${productIds.length > 1 ? 's sortis' : ' sorti'} du garde-manger`
        : 'C’est noté',
      'success',
    )
  }

  const cookedSheet = (
    <ActionSheet
      visible={confirmingCook}
      title={recipe.data ? `Tu as cuisiné « ${recipe.data.title} » ?` : ''}
      description={
        owned.length > 0
          ? `${owned.length} produit${owned.length > 1 ? 's quitteront' : ' quittera'} le garde-manger du foyer. C’est définitif.`
          : 'On le note dans l’historique du foyer. Rien ne quitte le garde-manger.'
      }
      options={[
        {
          testID: 'recipe-cooked-confirm',
          label: owned.length > 0 ? 'Oui, sortir les produits' : 'Oui, on l’a cuisinée',
          icon: (color) => <CircleCheckIcon size={18} color={color} />,
          tint: palette.mintPale,
          onPress: confirmCooked,
        },
      ]}
      onClose={() => setConfirmingCook(false)}
    />
  )


  async function handleAddMissing() {
    if (missing.length === 0 || adding) return
    setAdding(true)
    const failures: string[] = []
    for (const ingredient of missing) {
      // `source` is required by `createShoppingItemValidator` on the backend
      // (no default there — see the domain type's own note) and every
      // request was failing validation without it: this button added
      // nothing and every ingredient landed in `failures`, silently.
      const result = await createItem.mutateAsync({
        name: ingredient.label,
        quantity:
          ingredient.quantity !== null
            ? { amount: ingredient.quantity, unit: ingredient.unit ?? 'unité' }
            : { amount: 1, unit: 'unité' },
        source: 'recipe',
      })
      if (!result.ok) failures.push(ingredient.label)
    }
    queryClient.invalidateQueries({ queryKey: ['shopping-items'] })
    setAdding(false)
    showHint(
      failures.length === 0
        ? `${missing.length} ingrédient${missing.length > 1 ? 's ajoutés' : ' ajouté'} à la liste de courses`
        : `${failures.length} ingrédient${failures.length > 1 ? 's n’ont' : ' n’a'} pas pu être ajouté`,
      failures.length === 0 ? 'success' : 'error',
      failures.length === 0 ? { action: { label: 'Voir', onPress: () => router.push('/shopping-list') } } : undefined,
    )
  }

  return (
    <AppShell nav={nav} hint={hint} refresh={refresh} header={header}>

      <YStack
        marginTop="$5"
        backgroundColor={palette.brandDeep}
        padding="$5"
        gap="$3"
        style={{
          borderTopLeftRadius: 36,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 36,
          borderBottomLeftRadius: 20,
          shadowColor: palette.shadowCool,
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.22,
          shadowRadius: 28,
          elevation: 6,
        }}
      >
        <Text fontSize={24} fontWeight="800" color={palette.brandDeepText} lineHeight={30}>
          {data.title}
        </Text>
        {data.description ? (
          <Text fontSize={13} fontWeight="500" color={palette.brandDeepTextSecondary} lineHeight={19}>
            {data.description}
          </Text>
        ) : null}
        {/* Who, and what the foyer has done with it — the library's most
            shared artefact was anonymous everywhere it appeared. */}
        {provenance ? (
          <Text fontSize={12} fontWeight="600" color={palette.brandDeepTextSecondary}>
            {provenance}
          </Text>
        ) : null}
        <XStack gap="$2" flexWrap="wrap">
          {data.preparationTime ? (
            <XStack backgroundColor={palette.heroPillFill} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$3">
              <Text fontSize={12} fontWeight="700" color={palette.brandDeepText}>
                {data.preparationTime} min
              </Text>
            </XStack>
          ) : null}
          {data.tags.map((tag) => (
            <XStack key={tag} backgroundColor={palette.heroPillFill} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$3">
              <Text fontSize={12} fontWeight="700" color={palette.brandDeepText}>
                {tag}
              </Text>
            </XStack>
          ))}
        </XStack>
      </YStack>

      {owned.length > 0 ? (
        <IngredientGroup
          testID="recipe-owned"
          title="Déjà dans ton garde-manger"
          // The rapprochement is a name match made on this device and is
          // allowed to be wrong — said here, once, where the claim is made.
          note={match?.estimated ? 'Estimé d’après les noms de tes produits.' : undefined}
          items={owned}
          bg={palette.mintPale}
          labelColor={palette.mintPaleText}
          icon={<CircleCheckIcon size={16} color={palette.mintPaleText} />}
          palette={palette}
        />
      ) : null}

      {/* Not "tu as tout ce qu'il faut" and not an empty split: the fridge is
          simply unknown, and saying either would be a claim about a shared
          garde-manger this screen cannot currently read. */}
      {!pantryKnown ? (
        <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} marginTop="$4">
          On n’a pas pu lire ton garde-manger — la liste ci-dessous est complète, sans distinguer ce que tu as déjà.
        </Text>
      ) : null}

      {missing.length > 0 ? (
        <IngredientGroup
          testID="recipe-missing"
          title="À prévoir"
          items={missing}
          bg={palette.cream}
          labelColor={palette.creamText}
          icon={<ShoppingCartIcon size={16} color={palette.creamText} />}
          palette={palette}
        />
      ) : null}

      {missing.length > 0 ? (
        <PrimaryAction
          testID="recipe-add-missing"
          label={
            adding
              ? 'Ajout en cours…'
              : `Ajouter ${missing.length} ingrédient${missing.length > 1 ? 's' : ''} à la liste de courses`
          }
          disabled={adding}
          onPress={handleAddMissing}
          palette={palette}
        />
      ) : (
        <Text fontSize={13} fontWeight="600" color={palette.freshText} marginTop="$4">
          Tu as tout ce qu’il faut.
        </Text>
      )}

      {/*
        "J'ai cuisiné" — the half of the recommendation that was missing.
        The app told you to cook this to save the épinards, then had no way to
        hear that it worked: it recommended the same dish for the same product
        the next evening while the dashboard's overdue count climbed. Under the
        steps, not above them: it is the thing you press when you are done.
      */}
      {pantryKnown ? (
        <CookedAction
          testID="recipe-cooked"
          label={cooking ? 'On note…' : 'J’ai cuisiné'}
          hint={
            owned.length > 0
              ? `${owned.length} produit${owned.length > 1 ? 's' : ''} sortiront du garde-manger`
              : 'Rien à sortir du garde-manger'
          }
          disabled={cooking}
          onPress={() => setConfirmingCook(true)}
          palette={palette}
        />
      ) : null}

      <YStack marginTop="$6" gap="$3">
        <Text fontSize={15} fontWeight="800" color={palette.ink}>
          Préparation
        </Text>
        {preparation.map((step, index) => (
          <XStack key={`${index}-${step.slice(0, 12)}`} gap="$3" alignItems="flex-start">
            <YStack
              width={26}
              height={26}
              borderRadius={999}
              backgroundColor={palette.accentLime}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={12} fontWeight="800" color={palette.accentLimeText}>
                {index + 1}
              </Text>
            </YStack>
            <Text fontSize={14} fontWeight="500" color={palette.ink} flex={1} lineHeight={21}>
              {step}
            </Text>
          </XStack>
        ))}
      </YStack>

      <YStack marginTop="$6">
        <Pressable
          testID="recipe-open-shopping-list"
          onPress={() => router.navigate('/(tabs)/shopping-list')}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir la liste de courses"
          style={pointerCursor}
        >
          {/* `ChevronRightIcon`, not "→": a unicode arrow carries the platform
              font's weight and baseline instead of this system's 2px round
              stroke, and DESIGN.md bans it by name. */}
          <XStack alignItems="center" minHeight={44} gap="$2">
            <ShoppingCartIcon size={16} color={palette.inkSecondary} />
            <Text fontSize={13} fontWeight="700" color={palette.inkSecondary}>
              Voir la liste de courses
            </Text>
            <ChevronRightIcon size={15} color={palette.inkSecondary} />
          </XStack>
        </Pressable>
      </YStack>
      {cookedSheet}
      {deletionSheet}
    </AppShell>
  )
}

function IngredientGroup({
  testID,
  title,
  note,
  items,
  bg,
  labelColor,
  icon,
  palette,
}: {
  testID: string
  title: string
  /** A qualifier on the claim the heading makes, when the claim is an estimate. */
  note?: string
  items: RecipeIngredient[]
  bg: string
  labelColor: string
  icon: React.ReactNode
  palette: SoftPalette
}) {
  return (
    <YStack
      testID={testID}
      marginTop="$4"
      backgroundColor={bg}
      padding="$4"
      gap="$2"
      style={{
        borderTopLeftRadius: 26,
        borderTopRightRadius: 14,
        borderBottomRightRadius: 26,
        borderBottomLeftRadius: 14,
        shadowColor: palette.shadowCool,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 3,
      }}
    >
      <XStack alignItems="center" gap="$2">
        {icon}
        <Text fontSize={12} fontWeight="700" color={labelColor}>
          {title}
        </Text>
      </XStack>
      {note ? (
        <Text fontSize={11} fontWeight="500" color={labelColor} marginTop={-4} marginBottom="$1">
          {note}
        </Text>
      ) : null}
      {items.map((ingredient) => (
        <Text key={ingredient.id} fontSize={14} fontWeight="600" color={palette.ink}>
          {ingredientLine(ingredient)}
        </Text>
      ))}
    </YStack>
  )
}

/**
 * The quiet counterpart to `PrimaryAction`.
 *
 * Not lime: this system spends its one saturated colour on progress and on the
 * screen's single primary action, which here is still "ajouter les manquants".
 * Cooking is what you press *after* the dish exists, and it names the
 * consequence under the label rather than making you open the sheet to find
 * out what it will take out of the fridge.
 */
function CookedAction({
  testID,
  label,
  hint,
  onPress,
  disabled,
  palette,
}: {
  testID: string
  label: string
  hint: string
  onPress: () => void
  disabled?: boolean
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!disabled }}
      accessibilityLabel={`${label}. ${hint}.`}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], opacity: disabled ? 0.6 : 1 }}>
        <XStack
          marginTop="$5"
          alignItems="center"
          gap="$3"
          minHeight={52}
          paddingHorizontal="$4"
          backgroundColor={palette.mintPale}
          style={{
            borderTopLeftRadius: 20,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 20,
            borderBottomLeftRadius: 14,
          }}
        >
          <CircleCheckIcon size={18} color={palette.mintPaleText} />
          <YStack flex={1}>
            <Text fontSize={14} fontWeight="800" color={palette.mintPaleText}>
              {label}
            </Text>
            <Text fontSize={11} fontWeight="500" color={palette.mintPaleText}>
              {hint}
            </Text>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

function PrimaryAction({
  testID,
  label,
  onPress,
  disabled,
  palette,
}: {
  testID: string
  label: string
  onPress: () => void
  disabled?: boolean
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], opacity: disabled ? 0.6 : 1, marginTop: 16 }}>
        <XStack
          alignItems="center"
          justifyContent="center"
          minHeight={50}
          borderRadius={999}
          backgroundColor={palette.accentLime}
        >
          <Text fontSize={14} fontWeight="800" color={palette.accentLimeText}>
            {label}
          </Text>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
