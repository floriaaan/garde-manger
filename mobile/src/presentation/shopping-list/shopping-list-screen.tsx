/*
 * DIRECTION CONTRACT — shopping list screen (2026-08-28; a legal-pad
 * notepad, committed to rather than hinted at, per a second round of
 * feedback that explicitly asked for the yellow paper + spiral binding +
 * hand-drawn check this file's first version had deliberately avoided —
 * "if you're going to do it, do it," with the one guardrail being craft:
 * commit to the material, not to a costume version of it)
 *
 * First real "next page" past the Frigo dashboard, built once DESIGN.md
 * existed to build against instead of inventing tokens per screen. Same
 * world, same shell (mint blob ground on mobile, sidebar+frame on
 * tablet/desktop) — but the list card itself is a deliberate, disclosed
 * exception to system rules, scoped to this one screen only:
 *
 * — "No borders anywhere" (DESIGN.md Shapes) → a thin dashed rule between
 *   rows (a tear-line between list entries).
 * — Corner language is asymmetric-but-rounded everywhere else → this
 *   card's top edge is nearly square (a spiral runs along a flat edge in
 *   real life, never a rounded one); only the bottom corners round, and
 *   asymmetrically between them, so the "no uniform radius" rule still
 *   holds inside the exception.
 * — "Icons are drawn... in one consistent stroke and weight" (craft
 *   floor) still holds, but the checkmark and strikethrough in this list
 *   specifically are drawn as one imperfect, hand-felt pen stroke
 *   (`HandDrawnCheck`, the wavy strike inside `ShoppingRow`) instead of
 *   the app's usual precise lucide-style icon geometry — the one place
 *   in the system where "hand-drawn" is the honest material, not a slip.
 * — Every Pressable elsewhere spring-bounces on hover/press
 *   (`useHoverPress`) → `ShoppingRow` deliberately does NOT: a list of
 *   many rows all bouncing on hover read as gimmicky on the web (the
 *   complaint that started this file's first revision), so rows get a
 *   quiet, instant background tint on hover and a brief opacity dip on
 *   press instead — felt, not performed. That guardrail didn't change
 *   between rounds; only the paper commitment did.
 *
 * "Modern, not kitsch": the yellow is a muted legal-pad tone, not
 * highlighter/neon; the spiral is a strip of flat holes + a thin metal
 * ring, not an illustrated coil; the hand-drawn stroke is one confident
 * curve, not a jittery scribble. Three real material cues, executed with
 * restraint, not a pile of decorative textures.
 *
 * SCOPE: full CRUD is wired on this screen. Creating a new item goes
 * through the "+ Ajouter" pill → the `/new` route.
 *
 * Editing and deleting are reachable two ways since a usability critique:
 * the swipe actions, and a long press on the row — a gesture-only path is
 * invisible to a first-timer and unreachable for a screen-reader user, who
 * cannot swipe. Both land on the same titled sheet, which names the item
 * and carries an Annuler row, so a delete on shared household state always
 * costs two deliberate steps. It used to be one unconfirmed tap, on the
 * one screen in the app whose sibling (the fridge) did confirm.
 *
 * Checking an item is optimistic: in a supermarket on one bar of signal the
 * round trip is long enough that the row looked dead, and a failed toggle
 * surfaced nothing at all.
 */
import { useState } from 'react'
import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { SkeletonList } from '../shared/skeleton.js'
import { EmptyStateLottie } from '../shared/empty-state-lottie.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { useHint } from '../shared/hint-bubble.js'
import { goToScan } from '../shared/scan-sheet.js'
import { PillButton } from '../shared/pill-button.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ChevronRightIcon, PlusIcon, ShoppingCartIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { SpiralBinding } from './spiral-binding.js'
import { ShoppingRow } from './shopping-row.js'
import { useShoppingItemsQuery } from '../../application/shopping-list/shopping-items.query.js'
import { useUpdateShoppingItemMutation } from '../../application/shopping-list/update-shopping-item.mutation.js'
import { useDeleteShoppingItemMutation } from '../../application/shopping-list/delete-shopping-item.mutation.js'
import { useSyncShoppingListWithHaMutation } from '../../application/home-assistant/sync-shopping-list-with-ha.mutation.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'

export function ShoppingListScreen() {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const itemsQuery = useShoppingItemsQuery()
  // Invalidate explicitly on success — this "just worked" against the fake
  // connector without it (it mutates its fixture array in place, so the
  // cached reference happened to reflect the change on any re-render), but
  // that's a fake-connector accident, not real reactivity: the http
  // connector returns a fresh object from a fresh fetch, and without this
  // the list would silently show stale `checked` state against a real
  // backend. Caught by noticing the fake connector's own mutation style,
  // not by anything failing visibly in this session.
  const [hint, showHint] = useHint()
  const [sheetItem, setSheetItem] = useState<ShoppingItem | null>(null)
  // Optimistic: the checkbox flips now, and rolls back with a hint if the
  // server refuses. `onSettled` re-syncs either way.
  const updateItem = useUpdateShoppingItemMutation({
    onMutate: async ({ itemId, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['shopping-items'] })
      const previous = queryClient.getQueryData<ShoppingItem[]>(['shopping-items'])
      queryClient.setQueryData<ShoppingItem[]>(['shopping-items'], (current) =>
        (current ?? []).map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      const previous = (context as { previous?: ShoppingItem[] } | undefined)?.previous
      if (previous) queryClient.setQueryData(['shopping-items'], previous)
      showHint('Impossible de cocher cet article.')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['shopping-items'] }),
  })
  const deleteItem = useDeleteShoppingItemMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-items'] }),
  })

  const syncWithHa = useSyncShoppingListWithHaMutation()
  // Reconcile with Home Assistant first, best-effort: a shared list going
  // stale is what pull-to-refresh exists to fix, and the HA link is one more
  // possibly-unreachable network hop on top of that — its failure must never
  // stop the local reload below from running (design §8: a quiet failure,
  // never a blocking one).
  const refresh = usePullToRefresh(
    async () => {
      await syncWithHa.mutateAsync(undefined).catch(() => undefined)
    },
    () => itemsQuery.refetch(),
  )
  const items = itemsQuery.data ?? []
  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  async function handleToggle(item: ShoppingItem, next: boolean) {
    const result = await updateItem.mutateAsync({ itemId: item.id, patch: { checked: next } })
    if (!result.ok) showHint(result.error.message, 'error')
  }

  function handleEdit(item: ShoppingItem) {
    router.push({ pathname: '/(tabs)/shopping-list/[id]/edit', params: { id: item.id } })
  }

  async function handleDelete(item: ShoppingItem) {
    setSheetItem(null)
    const result = await deleteItem.mutateAsync(item.id)
    if (!result.ok) showHint(result.error.message, 'error')
  }

  return (
    <>
    <AppShell nav={{ kind: 'tab', tab: 'courses', onScan: goToScan }} hint={hint} refresh={refresh}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ShoppingCartIcon size={19} color={color} />}
          title="Liste de courses"
          subtitle={
            itemsQuery.isPending
              ? undefined
              : `${unchecked.length} article${unchecked.length > 1 ? 's' : ''} restant${unchecked.length > 1 ? 's' : ''}`
          }
          trailing={
            <Pressable
              testID="shopping-list-add"
              onPress={() => router.push('/(tabs)/shopping-list/new')}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un article"
              style={pointerCursor}
            >
              <XStack
                backgroundColor={palette.accentLime}
                borderRadius={999}
                gap="$1.5"
                paddingVertical="$2.5"
                paddingHorizontal="$3"
                minHeight={44}
                alignItems="center"
              >
                <PlusIcon size={15} color={palette.accentLimeText} />
                <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
                  Ajouter
                </Text>
              </XStack>
            </Pressable>
          }
        />
      }
    >
      {itemsQuery.isError ? (
        <XStack alignItems="center" gap="$3" backgroundColor={palette.expiredBg} borderRadius={14} padding="$3" marginTop="$4">
          <Text fontSize={13} fontWeight="600" color={palette.expiredText} flex={1}>
            Impossible de charger la liste de courses.
          </Text>
          <Pressable
            testID="shopping-list-retry"
            onPress={() => itemsQuery.refetch()}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
            style={pointerCursor}
          >
            <XStack alignItems="center" minHeight={44} paddingHorizontal="$3">
              <Text fontSize={13} fontWeight="800" color={palette.expiredText}>
                Réessayer
              </Text>
            </XStack>
          </Pressable>
        </XStack>
      ) : null}

      {!itemsQuery.isPending && !itemsQuery.isError && items.length === 0 ? (
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingHorizontal="$4">
          <EmptyStateLottie animation="shopping-list" size={256} />
          <Text fontSize={15} fontWeight="700" color={palette.ink}>
            Liste de courses vide
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
            Ajoute ce qui manque, ou pars d’une recette pour la remplir d’un coup.
          </Text>
          <PillButton
            testID="shopping-list-empty-add"
            label="Ajouter un article"
            onPress={() => router.push('/(tabs)/shopping-list/new')}
            palette={palette}
            centered
          />
        </YStack>
      ) : null}

      {unchecked.length > 0 ? (
        <YStack
          marginTop="$5"
          backgroundColor={palette.paperCard}
          overflow="hidden"
          style={{
            // Nearly-square top (a coil runs along a flat edge),
            // asymmetric rounded bottom — the "no uniform radius"
            // rule holds inside the notepad exception, just shaped
            // like a real pad instead of the app's usual soft corners.
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 20,
            borderBottomLeftRadius: 10,
            shadowColor: palette.shadowCool,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 1,
          }}
        >
          <SpiralBinding palette={palette} />
          <YStack paddingHorizontal="$2">
            {itemsQuery.isPending ? (
              <YStack paddingVertical="$2">
                <SkeletonList rows={4} label="Chargement de la liste" palette={palette} />
              </YStack>
            ) : null}
            {unchecked.map((item, index) => (
              <ShoppingRow
                key={item.id}
                item={item}
                isLast={index === unchecked.length - 1}
                onToggle={(next) => handleToggle(item, next)}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDelete(item)}
                onLongPress={() => setSheetItem(item)}
              />
            ))}
          </YStack>
        </YStack>
      ) : null}

      {checked.length > 0 ? (
        <YStack marginTop="$6">
          <Text fontSize={13} fontWeight="700" color={palette.inkSecondary}>
            Déjà pris ({checked.length})
          </Text>
          <YStack
            marginTop="$3"
            backgroundColor={palette.paperCard}
            paddingHorizontal="$2"
            style={{
              borderTopLeftRadius: 8,
              borderTopRightRadius: 16,
              borderBottomRightRadius: 8,
              borderBottomLeftRadius: 16,
              // A slight tilt — no spiral strip here on purpose: this
              // is the torn-off page set aside, not another notepad.
              transform: [{ rotate: '-1deg' }],
              shadowColor: palette.shadowCool,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 1,
            }}
          >
            {checked.map((item, index) => (
              <ShoppingRow
                key={item.id}
                item={item}
                isLast={index === checked.length - 1}
                onToggle={(next) => handleToggle(item, next)}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDelete(item)}
                onLongPress={() => setSheetItem(item)}
              />
            ))}
          </YStack>
        </YStack>
      ) : null}
    </AppShell>
    <ActionSheet
      visible={sheetItem !== null}
      onClose={() => setSheetItem(null)}
      title={sheetItem?.name}
      description="Supprimer retire l’article de la liste du foyer."
      options={
        sheetItem
          ? [
              {
                testID: 'shopping-list-edit-confirm',
                label: 'Modifier',
                icon: (color) => <ChevronRightIcon size={18} color={color} />,
                tint: palette.chipTeal,
                onPress: () => {
                  const item = sheetItem
                  setSheetItem(null)
                  handleEdit(item)
                },
              },
              {
                testID: 'shopping-list-delete-confirm',
                label: 'Supprimer',
                icon: (color) => <XIcon size={18} color={color} />,
                tint: palette.expired,
                destructive: true,
                onPress: () => handleDelete(sheetItem),
              },
            ]
          : []
      }
    />
    </>
  )
}
