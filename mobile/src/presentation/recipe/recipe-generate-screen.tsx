/*
 * DIRECTION CONTRACT — the recipe composer, presented modally (2026-09-05)
 *
 * "Générer une recette" was a single lime card with a fixed caption and no
 * way to say anything: the endpoint has always accepted a free-text
 * `prompt` and the UI always sent `undefined`. So the app could cook from
 * the garde-manger but never from an intention — "quelque chose de rapide",
 * "sans four", "pour quatre" — which is how anyone actually decides dinner.
 *
 * It is a modal, not a panel on the Recettes list: the ask is six groups of
 * choices deep, and a form that long unfolding inside a list pushes the
 * recipes it is supposed to sit beside off the screen. A modal is also the
 * honest shape for the interaction — a self-contained sub-task with one way
 * out — which is the platform rule on both iOS (sheet) and Android.
 *
 * Everything on it is optional, and the screen says so out loud: an
 * untouched form sends no prompt at all and generates exactly as the button
 * did before this screen existed. The chips are the same `Chip` the location
 * filters and AI providers use, never a new control, and every clause they
 * contribute is written in `recipe-prompt.ts` so the sentence the model
 * receives is readable in one file.
 *
 * COPY (2026-09-05, asked for directly: "pas de notions péjoratives comme
 * « ce qui périme »"): the whole app left the register of a food inspector
 * for the register of a cook. A date is still a date — "Date dépassée de
 * 3 j" is unmistakable — but nothing frames the household's own food as
 * decaying, or the household as negligent, which matters twice over on a
 * surface several people read. `expiryLabel` in product-status.ts is the one
 * source of truth for that vocabulary; the warning triangle over "On part
 * de" went with it, since the glyph was the visual half of the same
 * sentence.
 *
 * The generation itself is seconds long and blocking: it owns a real
 * loading state (`GeneratingOverlay`) that names what is happening and what
 * it is cooking from, rather than a button that goes quiet. Failures land
 * above the button that caused them and stay there — "Ajoute des produits…"
 * is a state you act on, not a toast to catch.
 */
import { ConnectedPaywall } from '../settings/ai-access-cards.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'
import { useEffect, useRef, useState } from 'react'
import { Animated, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { ProgressBar } from '../shared/progress-bar.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { Chip } from '../shared/chip.js'
import { PillButton } from '../shared/pill-button.js'
import { FormField } from '../fridge/form-field.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import {
  BanIcon,
  ChefHatIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleXIcon,
  ClockIcon,
  FlameIcon,
  GlobeIcon,
  LayoutGridIcon,
  LeafIcon,
  PackageIcon,
  PencilIcon,
  SearchIcon,
  UsersIcon,
  UtensilsIcon,
  XIcon,
} from '../dashboard/dashboard-icons.js'
import { daysUntilExpiry, expiryLabel, sortByExpiry } from '../dashboard/product-status.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import type { Product } from '../../domain/fridge/product.js'
import { useEnqueueRecipeGenerationMutation } from '../../application/job/job-mutations.js'
import { useJobQuery } from '../../application/job/jobs.query.js'
import { useWatchJob } from '../../application/job/watched-jobs.js'
import { isJobActive } from '../../domain/job/job.js'
import {
  composeRecipePrompt,
  countSelections,
  EMPTY_WISH,
  isSelected,
  isPinned,
  isWishEmpty,
  joinFr,
  RECIPE_OPTION_GROUPS,
  toggleOption,
  togglePinned,
  type RecipeOptionGroup,
  type RecipeWish,
} from './recipe-prompt.js'

/** How many products the card offers with an empty search. Typing shows every match instead. */
const PANTRY_SUGGESTION_COUNT = 8

/**
 * An error is a state to act on, not a sentence to read. The backend's
 * `ApiError.type` already says which action would fix it, and the canonical
 * one — `no_products` — used to tell the cook to go somewhere this modal has
 * removed every route to (it draws no Sidebar and no bottom nav at any
 * width). So the chip carries the door.
 */
type Recovery = 'add-product' | 'retry' | null
interface GenerationError {
  message: string
  recovery: Recovery
  quota?: boolean
}

function recoveryFor(type: string): Recovery {
  if (type === 'no_products') return 'add-product'
  if (type === 'network_error' || type === 'server_error' || type === 'generation_failed') return 'retry'
  return null
}

/**
 * One glyph per group label — six groups asking six different questions is
 * exactly the case DESIGN.md's "an icon only when it distinguishes" rule is
 * for. The chips *inside* a group deliberately carry none: four identical
 * `UsersIcon`s down the Portions row would be decoration, which the same rule
 * bans (the date shortcuts and the AI providers already settled it).
 */
const GROUP_ICONS: Record<RecipeOptionGroup['icon'], (color: string) => React.ReactNode> = {
  repas: (color) => <UtensilsIcon size={13} color={color} />,
  temps: (color) => <ClockIcon size={13} color={color} />,
  regime: (color) => <LeafIcon size={13} color={color} />,
  cuisine: (color) => <GlobeIcon size={13} color={color} />,
  enCuisine: (color) => <FlameIcon size={13} color={color} />,
  portions: (color) => <UsersIcon size={13} color={color} />,
}

export function RecipeGenerateScreen() {
  const palette = useSoftPalette()
  const layout = useAppShellLayout({ kind: 'modal' })
  const queryClient = useQueryClient()
  const productsQuery = useProductsQuery()
  const householdQuery = useHouseholdQuery()
  const enqueue = useEnqueueRecipeGenerationMutation()
  const [jobId, setJobId] = useState<string | undefined>()
  const job = useJobQuery(jobId).data ?? null
  useWatchJob(jobId)
  const handledRef = useRef<string | null>(null)
  // The wait is the job's, not the request's: the enqueue answers at once.
  const waiting = enqueue.isPending || (job !== null && isJobActive(job))
  const { canSubscribe } = useAiSubscribe()
  const [wish, setWish] = useState<RecipeWish>(EMPTY_WISH)
  const [enqueueError, setEnqueueError] = useState<GenerationError | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState<'reset' | 'close' | null>(null)
  // The sheet always opens on `EMPTY_WISH`, so this starts closed. Once open
  // it stays open for the visit; the collapsed row still counts the choices
  // behind it, so a selection is never hidden without saying so.
  const [refining, setRefining] = useState(false)

  // Sorted, uncapped: the search list needs every product to filter through, not just the nearest few.
  const pantry = sortByExpiry(productsQuery.data ?? [])
  const empty = isWishEmpty(wish)
  const chosen = countSelections(wish)
  // The foyer already knows how many people it feeds. Asking a household of
  // three to tap "Pour 4" on every generation, forever, is the app declining to
  // use the one number it holds that no competitor does.
  const foyerSize = householdQuery.data?.members.length ?? null

  /**
   * Any irreversible action on an unsaved form goes through a sheet that names
   * the consequence — DESIGN.md names this exact case. "Tout effacer" used to
   * wipe up to 24 decisions from one tap of a 12px grey link.
   */
  function askDiscard(intent: 'reset' | 'close') {
    if (isWishEmpty(wish)) {
      if (intent === 'close') router.dismiss()
      else setWish(EMPTY_WISH)
      return
    }
    setConfirmDiscard(intent)
  }

  function handleClose() {
    askDiscard('close')
  }

  function goAddProduct() {
    // Leave the sheet first: this modal draws no nav at any width, so the
    // route out has to be spent, not offered.
    router.dismiss()
    router.push('/(tabs)/fridge/new')
  }

  function toError(type: string, message: string): GenerationError {
    return { message, recovery: recoveryFor(type), quota: type === 'ai_quota_exceeded' }
  }

  async function handleGenerate() {
    if (waiting) return
    setEnqueueError(null)
    const result = await enqueue.mutateAsync(composeRecipePrompt(wish))
    if (!result.ok) {
      setEnqueueError(toError(result.error.type, result.error.message))
      return
    }
    setJobId(result.value.id)
  }

  // The job's own outcome, derived rather than stored: a new enqueue swaps the job and the message goes with it.
  const [firstRecipeId] = job?.result?.recipeIds ?? []
  const jobError: GenerationError | null =
    job?.status === 'failed'
      ? toError(job.error?.type ?? 'unknown', job.error?.message ?? 'La génération a échoué.')
      : job?.status === 'succeeded' && !firstRecipeId
        ? {
            // A successful call that produced nothing must not dismiss the sheet in silence.
            message: 'Aucune recette n’est sortie de cette demande. Essaie avec moins de contraintes.',
            recovery: 'retry',
          }
        : null
  const error = enqueueError ?? jobError

  // Navigates once, on success. `JobHost` stays silent: this screen is watching.
  useEffect(() => {
    if (!job || job.status !== 'succeeded' || !firstRecipeId || handledRef.current === job.id) return
    handledRef.current = job.id
    queryClient.invalidateQueries({ queryKey: ['recipes'] })
    // `dismiss()` before pushing — replacing the modal route would present the recipe itself as a modal.
    router.dismiss()
    router.push({ pathname: '/(tabs)/recipes/[id]', params: { id: firstRecipeId } })
  }, [job, firstRecipeId, queryClient])

  return (
    <AppShell
      nav={{ kind: 'modal' }}
      scrollable={false}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ChefHatIcon size={19} color={color} />}
          title="Envie de quoi ?"
          subtitle="Tout est facultatif. Sans rien, on cuisine ce qu’il faut finir en premier."
          // No way out while the request is in flight — the same rule the
          // blocking overlay used to enforce with a scrim. The call cannot be
          // cancelled, so an exit here would leave a recipe arriving into a
          // screen that is gone.
          trailing={waiting ? null : <CloseButton palette={palette} onPress={handleClose} />}
        />
      }
    >
      {waiting ? <GeneratingState palette={palette} pinned={wish.pinned} onLater={() => router.dismiss()} /> : null}

      {/* Same recipe as the receipt review's form: without it the pinned
          "Générer" bar sits under the keyboard the moment a cook taps
          "Une envie ?". */}
      {waiting ? null : (
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ ...shellContentStyle({ ...layout, hasMobileNav: false }), paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >

          {productsQuery.isError ? (
            // A failed fetch here used to render identically to "no products
            // near expiry" (empty `cookingFrom`) on the one screen whose whole
            // pitch is cooking from what the garde-manger already has.
            <YStack marginBottom="$4" gap="$2" backgroundColor={palette.cream} padding="$4" borderRadius={18}>
              <Text fontSize={13} fontWeight="700" color={palette.ink}>
                Garde-manger indisponible
              </Text>
              <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} lineHeight={17}>
                On ne peut pas dire ce que tu as sous la main pour l’instant — la génération partira sans « Ce soir ».
              </Text>
              <PillButton
                testID="recipe-generate-retry-products"
                label="Réessayer"
                accessibilityLabel="Réessayer de charger le garde-manger"
                onPress={() => productsQuery.refetch()}
                palette={palette}
                tone="quiet"
              />
            </YStack>
          ) : null}

          <PantrySuggestions
            products={pantry}
            loading={productsQuery.isPending}
            palette={palette}
            onAddProduct={goAddProduct}
            isPinned={(name) => isPinned(wish, name)}
            onTogglePin={(name) => setWish((current) => togglePinned(current, name))}
          />

          <YStack marginTop="$5" gap="$4">
            <FormField
              testID="recipes-wish"
              label="Une envie ?"
              value={wish.freeText}
              onChangeText={(freeText) => setWish((current) => ({ ...current, freeText }))}
              palette={palette}
              placeholder="un gratin, quelque chose de réconfortant…"
              autoCapitalize="sentences"
              // Not SparklesIcon: sparkles means "IA" everywhere else in this
              // system (Réglages' "Fournisseur IA"), so on the human's own
              // sentence it mis-signals which side of the conversation this is.
              icon={(color) => <PencilIcon size={13} color={color} />}
            />

            {/* Folded by default. The composer's thesis is "tout est
                facultatif" and its one-tap path is well defended — but its
                *visual* argument was 24 generic chips across six groups, four
                of whose headings sat below the fold on a phone. So the screen
                read as a form to fill rather than a shortcut to skip, and the
                one control no competitor can offer (the pantry above) was the
                small thing at the top. It opens on its own if the cook already
                chose something, so a returning selection is never hidden. */}
            <Pressable
              testID="recipes-refine"
              onPress={() => setRefining((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: refining }}
              accessibilityLabel={refining ? 'Replier les options' : 'Affiner la recette'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[pointerCursor, { alignSelf: 'flex-start' }]}
            >
              <XStack alignItems="center" gap="$2" minHeight={44}>
                <LayoutGridIcon size={15} color={palette.inkSecondary} />
                <Text fontSize={14} fontWeight="800" color={palette.ink}>
                  Affiner
                </Text>
                <Text fontSize={12} fontWeight="500" color={palette.inkSecondary}>
                  {chosen > 0 ? `${chosen} choix` : 'repas, temps, régime…'}
                </Text>
              </XStack>
            </Pressable>

            {refining ? RECIPE_OPTION_GROUPS.map((group) => (
              // The heading role on the label plus the group-prefixed chip
              // labels below are what stop a screen reader reading 24
              // anonymous buttons in one undifferentiated run. A role on this
              // container would not help: making it `accessible` would hide the
              // chips inside it, and a bare label on a non-accessible view is
              // never announced.
              <YStack key={group.id} gap="$2">
                <XStack alignItems="center" gap="$1.5" accessibilityRole="header">
                  {GROUP_ICONS[group.icon](palette.inkSecondary)}
                  <Text fontSize={12} fontWeight="700" color={palette.ink}>
                    {group.label}
                  </Text>
                </XStack>
                {/* gap $3: the chips draw at 32pt and reach the 44pt touch
                    floor through hitSlop, so anything tighter overlaps two
                    press areas. */}
                <XStack gap="$3" flexWrap="wrap">
                  {group.options.map((option) => (
                    <Chip
                      key={option.id}
                      testID={`recipes-option-${group.id}-${option.id}`}
                      label={
                        // The foyer's own size is marked on the chip that matches
                        // it, so the default is visible rather than assumed.
                        group.id === 'portions' && option.id === String(foyerSize)
                          ? `${option.label} · ton foyer`
                          : option.label
                      }
                      // Drawn: "15 min". Announced: "Temps en cuisine : 15 min".
                      accessibilityLabel={`${group.label} : ${option.label}`}
                      selected={isSelected(wish, group.id, option.id)}
                      onPress={() => setWish((current) => toggleOption(current, group, option.id))}
                      palette={palette}
                    />
                  ))}
                </XStack>
              </YStack>
            )) : null}

            {refining ? (
            <FormField
              testID="recipes-avoid"
              label="À éviter"
              value={wish.avoid}
              onChangeText={(avoid) => setWish((current) => ({ ...current, avoid }))}
              palette={palette}
              placeholder="champignons, piment…"
              hint="Ce qu’on ne met pas dedans, même si c’est dans le garde-manger."
              autoCapitalize="none"
              icon={(color) => <BanIcon size={13} color={color} />}
            />
            ) : null}

            {!empty ? (
              <Pressable
                testID="recipes-wish-reset"
                onPress={() => askDiscard('reset')}
                accessibilityRole="button"
                accessibilityLabel="Tout effacer"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[pointerCursor, { alignSelf: 'flex-start' }]}
              >
                <Text fontSize={12} fontWeight="700" color={palette.inkSecondary}>
                  Tout effacer
                </Text>
              </Pressable>
            ) : null}
          </YStack>
        </ScrollView>

        {/* Same measure as the scroll above it: `shellContentStyle` caps the
            form at 640 and centres it, so an edge-to-edge action bar underneath
            would read as belonging to the window, not to the form. */}
        <YStack
          paddingHorizontal={20}
          paddingBottom={layout.isWide ? 24 : 12}
          paddingTop="$2"
          gap="$2"
          width="100%"
          maxWidth={layout.isWide ? 640 : undefined}
          alignSelf="center"
        >
          {error?.quota && canSubscribe ? (
            <ConnectedPaywall palette={palette} reason="Quota gratuit atteint" />
          ) : error ? (
            <XStack
              testID="recipes-generate-error"
              alignItems="center"
              backgroundColor={palette.expiredBg}
              borderRadius={14}
              gap="$2"
              padding="$3"
              accessibilityLiveRegion="polite"
            >
              {/* Icon AND colour AND word — a status that survives grayscale. */}
              <CircleXIcon size={14} color={palette.expiredText} />
              <Text fontSize={13} fontWeight="600" color={palette.expiredText} flex={1}>
                {error.message}
              </Text>
              {error.recovery === 'add-product' ? (
                <RecoveryPill testID="recipes-error-add-product" label="Ajouter" palette={palette} onPress={goAddProduct} />
              ) : error.recovery === 'retry' ? (
                <RecoveryPill testID="recipes-error-retry" label="Réessayer" palette={palette} onPress={handleGenerate} />
              ) : null}
            </XStack>
          ) : null}
          {!empty ? (
            <Text testID="recipes-prompt-preview" fontSize={11} fontWeight="500" color={palette.inkSecondary} numberOfLines={2}>
              {/* The composed sentence, verbatim. Counting the choices told the
                  cook how many boxes they ticked; this tells them what the
                  machine will actually be asked. */}
              On demandera : « {composeRecipePrompt(wish)} »
            </Text>
          ) : null}
          <GenerateButton
            palette={palette}
            label={empty ? 'Générer une recette' : 'Générer avec ces envies'}
            caption={
              empty
                ? 'Sans contrainte : on part des dates les plus proches.'
                : wish.pinned.length > 0
                  ? `Autour de ${joinFr(wish.pinned)}`
                  : summarize(wish.freeText, wish.avoid, chosen)
            }
            onPress={handleGenerate}
          />
        </YStack>
      </KeyboardAvoidingView>
      )}

      <ActionSheet
        visible={confirmDiscard !== null}
        title="Effacer cette envie ?"
        description="Les choix de cette feuille seront perdus."
        options={[
          {
            testID: 'recipes-discard-confirm',
            label: confirmDiscard === 'close' ? 'Fermer sans garder' : 'Tout effacer',
            icon: (color) => <BanIcon size={18} color={color} />,
            tint: palette.expiredBg,
            destructive: true,
            onPress: () => {
              const intent = confirmDiscard
              setConfirmDiscard(null)
              setWish(EMPTY_WISH)
              if (intent === 'close') router.dismiss()
            },
          },
        ]}
        onClose={() => setConfirmDiscard(null)}
      />
    </AppShell>
  )
}

/** "3 choix · une envie · une exclusion" — what the button is about to send, counted. */
function summarize(freeText: string, avoid: string, chosen: number): string {
  const parts: string[] = []
  if (chosen > 0) parts.push(`${chosen} choix`)
  if (freeText.trim()) parts.push('une envie')
  if (avoid.trim()) parts.push('une exclusion')
  return parts.join(' · ')
}

function CloseButton({ palette, onPress }: { palette: SoftPalette; onPress: () => void }) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID="recipes-generate-close"
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Fermer"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <YStack width={38} height={38} borderRadius={999} backgroundColor={palette.cream} alignItems="center" justifyContent="center">
          <XIcon size={18} color={palette.ink} />
        </YStack>
      </Animated.View>
    </Pressable>
  )
}

/**
 * What the garde-manger can offer this recipe — a proposal, never a list the
 * cook has to accept. Nothing here starts chosen: the backend already receives
 * the whole garde-manger and is told to pick what goes together, so an
 * untouched card generates exactly as it did before, and a touched one only
 * *adds* an instruction ("en utilisant …"). The card used to be headed "On
 * part de" over four inert-looking rows, which announced four products as
 * already decided when they were neither chosen nor, on their own, what the
 * model cooked from.
 *
 * The selection control is the screen's own `Chip` — the same one the 24
 * refine options use — rather than the tick-box rows it replaces: a tick box
 * is the idiom for a checklist to complete, which is the exact opposite of
 * what this card is. Only the products with little time left carry their count
 * ("Yaourt · 2 j"); for the rest the ordering already says it.
 *
 * The eight nearest-to-expire were the whole offer at first — a garde-manger
 * of thirty had no way to pin the other twenty-two. A search field, the same
 * `FormField` the fridge list already filters with, turns the card into a
 * proper list: empty, it still shows the eight most urgent; typed, it shows
 * every match regardless of how far off its date is.
 */
function PantrySuggestions({
  products,
  loading,
  palette,
  onAddProduct,
  isPinned,
  onTogglePin,
}: {
  /** Sorted by expiry, uncapped — the search below decides how much of it is shown. */
  products: readonly Product[]
  loading: boolean
  palette: SoftPalette
  onAddProduct: () => void
  isPinned: (name: string) => boolean
  onTogglePin: (name: string) => void
}) {
  // Open by default — it's the one thing on this screen no competitor can
  // offer, so it earns first look. Collapsible so a cook who already knows
  // what's in the fridge can fold it away without scrolling past it.
  const [expanded, setExpanded] = useState(true)
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const matching = needle.length > 0 ? products.filter((product) => product.name.toLowerCase().includes(needle)) : products
  const shown = needle.length > 0 ? matching : matching.slice(0, PANTRY_SUGGESTION_COUNT)

  return (
    <YStack
      marginTop="$5"
      backgroundColor={palette.gradientBottom}
      padding="$3"
      gap="$2"
      style={{
        borderTopLeftRadius: 14,
        borderTopRightRadius: 24,
        borderBottomRightRadius: 14,
        borderBottomLeftRadius: 24,
        shadowColor: palette.shadowCool,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 1,
      }}
    >
      <Pressable
        testID="recipes-cooking-from-toggle"
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Replier Sous la main' : 'Déplier Sous la main'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={pointerCursor}
      >
        <XStack alignItems="center" gap="$2" minHeight={28}>
          {/* The garde-manger's own tab glyph, not a warning triangle: this card
              lists products, it does not raise an alarm about them. */}
          <PackageIcon size={14} color={palette.inkSecondary} />
          <Text fontSize={12} fontWeight="700" color={palette.ink} flex={1}>
            Sous la main{!expanded && products.length > 0 ? ` · ${products.length}` : ''}
          </Text>
          {expanded ? (
            <ChevronDownIcon size={15} color={palette.inkSecondary} />
          ) : (
            <ChevronRightIcon size={15} color={palette.inkSecondary} />
          )}
        </XStack>
      </Pressable>
      {expanded && products.length > 0 ? (
        <Text fontSize={12} fontWeight="500" color={palette.inkSecondary}>
          Rien n’est imposé : touche un produit pour que la recette tourne autour. Sinon on pioche librement, les plus pressés d’abord.
        </Text>
      ) : null}
      {!expanded ? null : loading ? (
        <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
          Chargement…
        </Text>
      ) : products.length === 0 ? (
        // The next action lives inside the empty state, not six seconds and one
        // failed request later: this is the screen that knows the garde-manger
        // is empty, and it is the only one that can say so before the wait.
        <YStack gap="$3">
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
            Rien dans le garde-manger pour l’instant — la recette partira de tes envies seules.
          </Text>
          <RecoveryPill
            testID="recipes-empty-add-product"
            label="Ajouter un produit"
            tone="neutral"
            palette={palette}
            onPress={onAddProduct}
          />
        </YStack>
      ) : (
        <>
          <FormField
            testID="recipes-pantry-search"
            label="Chercher un produit"
            value={search}
            onChangeText={setSearch}
            palette={palette}
            placeholder="Un nom de produit"
            autoCapitalize="none"
            icon={(color) => <SearchIcon size={13} color={color} />}
          />
          {shown.length === 0 ? (
            <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
              Aucun produit ne correspond à « {search.trim()} ».
            </Text>
          ) : (
            // gap $3, per `Chip`'s own rule: two chips closer than the sum of their
            // facing slops have overlapping press areas.
            <XStack gap="$3" flexWrap="wrap" marginTop="$1">
              {shown.map((product) => (
                <Chip
                  key={product.id}
                  testID={`recipes-pin-${product.id}`}
                  label={pantryChipLabel(product)}
                  // Drawn "Yaourt · 2 j"; announced with the full sentence the rest
                  // of the app uses for a date.
                  accessibilityLabel={`${product.name} — ${expiryLabel(daysUntilExpiry(product))}`}
                  selected={isPinned(product.name)}
                  onPress={() => onTogglePin(product.name)}
                  palette={palette}
                />
              ))}
            </XStack>
          )}
        </>
      )}
    </YStack>
  )
}

/** "Yaourt · 2 j" for the ones that are running out, the bare name for the rest. */
function pantryChipLabel(product: Product): string {
  const days = daysUntilExpiry(product)
  if (days === null || days > 3) return product.name
  if (days < 0) return `${product.name} · dépassé`
  if (days === 0) return `${product.name} · aujourd’hui`
  return `${product.name} · ${days} j`
}

/**
 * No `pending` state: the whole form — this button included — unmounts while
 * the request is in flight, and `GeneratingState` takes the sheet. The button
 * used to carry a spinner, a "Génération en cours…" label and a 0.7 opacity
 * that became unreachable the moment the loader moved out of its popup, and
 * that spinner also contradicted DESIGN.md's own rule — the OS drawing a wait
 * on the screen whose entire job is waiting, three lines below a `PulseDots`.
 */
function GenerateButton({
  palette,
  label,
  caption,
  onPress,
}: {
  palette: SoftPalette
  label: string
  caption: string
  onPress: () => void
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID="recipes-generate-submit"
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="center"
          gap="$3"
          backgroundColor={palette.accentLime}
          padding="$4"
          minHeight={50}
          style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 24,
            borderBottomLeftRadius: 14,
          }}
        >
          <ChefHatIcon size={20} color={palette.accentLimeText} />
          <YStack flex={1} minWidth={0}>
            <Text fontSize={14} fontWeight="800" color={palette.accentLimeText}>
              {label}
            </Text>
            {caption ? (
              <Text fontSize={12} fontWeight="500" color={palette.accentLimeText} opacity={0.8} numberOfLines={1}>
                {caption}
              </Text>
            ) : null}
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

/**
 * The wait, in the sheet — not a card floating over it behind a scrim.
 *
 * This used to be a `GeneratingOverlay`: a dimming layer and a second rounded
 * block on top of the composer. That is a modal raised over a modal, and it
 * costs two things. The scrim tells a cook their form is still there and still
 * theirs, which is false — the answer to the question they asked is already on
 * its way and nothing they touch can change it. And the floating card competes
 * with the sheet it covers for the same job, on a screen that only ever does
 * one thing at a time.
 *
 * So the sheet *becomes* the wait. The form unmounts, the header keeps naming
 * the screen, and the body holds a single centred state on the sheet's own
 * ground. Nothing is layered, nothing is dimmed, and there is exactly one
 * thing on screen — which is the honest picture of what is happening.
 *
 * The form is unmounted rather than hidden: a scrim over live controls left a
 * screen reader swiping into inputs that no longer accepted anything, which is
 * why the old version needed `accessibilityElementsHidden` at all. Gone
 * controls need no such fence.
 */
function GeneratingState({
  palette,
  pinned,
  onLater,
}: {
  palette: SoftPalette
  /** What the cook pinned, if anything — never products the screen chose for them. */
  pinned: readonly string[]
  onLater: () => void
}) {
  const names = pinned.slice(0, 3)
  return (
    <YStack
      testID="recipes-generating"
      flex={1}
      minHeight={0}
      alignItems="center"
      justifyContent="center"
      padding="$6"
      gap="$3"
      accessibilityLiveRegion="polite"
    >
      <YStack width="100%" maxWidth={280}>
        <ProgressBar palette={palette} testID="recipes-generating-bar" label="Génération en cours" />
      </YStack>
      <Text fontSize={18} fontWeight="800" color={palette.ink} textAlign="center">
        On écrit ta recette
      </Text>
      <Text fontSize={14} fontWeight="500" color={palette.inkSecondary} textAlign="center" maxWidth={320}>
        {names.length > 0
          ? `On part de ${joinFr(names)}. Quelques secondes.`
          : 'Quelques secondes, le temps que l’IA réponde.'}
      </Text>
      <PillButton testID="recipes-generating-later" label="Je reviens plus tard" tone="quiet" palette={palette} onPress={onLater} />
    </YStack>
  )
}

/** The way out of an error, inside the error. A pill, per the system's "pill means status/action/badge" rule. */
function RecoveryPill({
  testID,
  label,
  palette,
  onPress,
  tone = 'error',
}: {
  testID: string
  label: string
  palette: SoftPalette
  onPress: () => void
  /** `error` sits inside the coral chip; `neutral` sits on a white card. */
  tone?: 'error' | 'neutral'
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      // A pill sizes to its label; a Pressable in a YStack stretches by default.
      style={[pointerCursor, { alignSelf: 'flex-start' }]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          // `expiredText`, not `gradientBottom`. The ground colour made a white
          // pill on a coral card in light mode and a #120D08 pill on a #3B1712
          // card in dark — a button *darker* than the surface holding it, which
          // reads as a hole. Filling with the card's own text colour inverts
          // correctly in both themes.
          backgroundColor={tone === 'error' ? palette.expiredText : palette.accentLime}
          paddingVertical="$1.5"
          paddingHorizontal="$3"
          borderRadius={999}
        >
          <Text fontSize={12} fontWeight="800" color={tone === 'error' ? palette.gradientBottom : palette.accentLimeText}>
            {label}
          </Text>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
