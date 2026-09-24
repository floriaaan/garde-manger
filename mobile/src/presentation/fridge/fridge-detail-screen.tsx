/*
 * One product, and the two things a foyer member does with it: say what
 * became of it, or correct a mistake.
 *
 * Three fixes from a usability critique live here. The delete confirmation
 * used to render *at the same screen position* as the trigger, so a second
 * impatient tap destroyed a product on shared state with no dialog and no
 * undo — it is now a titled ActionSheet that names the consequence. The
 * screen showed a raw `Expire le 12/09/2026` with no status chip, breaking
 * DESIGN.md's own "every status is icon + color + word" invariant on the
 * one screen where expiry is the subject. And finishing the milk could
 * only be expressed as deletion, through the edit form.
 *
 * Finishing a product is now an outcome recorded for the foyer's
 * statistics (ADR-0012), and removing it before it's finished asks what
 * became of it instead of assuming a mistake.
 */
import { useState } from 'react'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { Skeleton, SkeletonGroup, SkeletonRow } from '../shared/skeleton.js'
import { ProductExitSheet } from './product-exit-sheet.js'
import { AuthButton } from '../identity/auth-button.js'
import { useHint } from '../shared/hint-bubble.js'
import { goBack } from '../shared/navigation.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { StatusChip } from '../dashboard/status-chip.js'
import { CircleCheckIcon, PackageIcon } from '../dashboard/dashboard-icons.js'
import { daysUntilExpiry, expiryLabel, statusOf } from '../dashboard/product-status.js'
import { useProductQuery } from '../../application/fridge/product.query.js'
import { useDeleteProductMutation } from '../../application/fridge/delete-product.mutation.js'
import { useRecordProductOutcomeMutation } from '../../application/fridge/record-product-outcome.mutation.js'
import type { DiscardReason, RecordProductOutcomeInput } from '../../domain/fridge/product-outcome.js'

const LOCATION_LABEL = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' } as const

type Gone = 'consumed' | 'discarded' | 'deleted'

const GONE_COPY: Record<Gone, string> = {
  consumed: 'Produit terminé',
  discarded: 'Produit jeté',
  deleted: 'Produit supprimé',
}

export function FridgeDetailScreen({ productId }: { productId: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const product = useProductQuery(productId)
  const refresh = usePullToRefresh(() => product.refetch())
  const deleteProduct = useDeleteProductMutation()
  const recordOutcome = useRecordProductOutcomeMutation()
  const [hint, showHint] = useHint()
  const [exiting, setExiting] = useState(false)
  const [gone, setGone] = useState<Gone | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function leave(reason: Gone) {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    setGone(reason)
    router.back()
  }

  async function record(input: RecordProductOutcomeInput) {
    setExiting(false)
    setActionError(null)
    const result = await recordOutcome.mutateAsync({ productId, input })
    if (!result.ok) {
      setActionError(result.error.message)
      return
    }
    const remaining = result.value.product
    if (remaining === null) {
      leave(input.kind)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['product', productId] })
    showHint(`Il en reste ${remaining.quantity.amount} ${remaining.quantity.unit}`)
  }

  async function handleCorrection() {
    setExiting(false)
    setActionError(null)
    const result = await deleteProduct.mutateAsync(productId)
    if (!result.ok) {
      setActionError(result.error.message)
      return
    }
    leave('deleted')
  }

  function handleDiscarded({ discardReason, amount }: { discardReason: DiscardReason | null; amount: number | null }) {
    return record({ kind: 'discarded', discardReason, ...(amount === null ? {} : { amount }) })
  }

  const header = (
    <ScreenHeader
      palette={palette}
      tint={palette.cabinetEnamel}
      icon={(color) => <PackageIcon size={19} color={color} />}
      title="Produit"
      onBack={() => goBack('/(tabs)/fridge')}
    />
  )

  // The post-exit frame used to be a naked `<Text>` outside AppShell — no
  // background, no safe area, no way back — reachable on web where the pop
  // may not unmount the screen.
  if (gone) {
    return (
      <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={header}>
        <YStack alignItems="center" gap="$2" marginTop="$8">
          <Text testID="fridge-detail-gone" fontSize={15} fontWeight="700" color={palette.ink}>
            {GONE_COPY[gone]}
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
            Il a disparu du garde-manger de tout le foyer.
          </Text>
        </YStack>
      </AppShell>
    )
  }

  if (product.isPending) {
    return (
      <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={header}>
        <SkeletonGroup label="Chargement du produit">
          <Skeleton width="64%" height={22} />
          <Skeleton width="36%" height={13} />
          <YStack marginTop="$4" gap="$1">
            <SkeletonRow />
            <SkeletonRow />
          </YStack>
        </SkeletonGroup>
      </AppShell>
    )
  }

  if (!product.data) {
    return (
      <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={header}>
        <YStack marginTop="$5">
          <Text color={palette.inkSecondary}>Produit introuvable.</Text>
        </YStack>
      </AppShell>
    )
  }

  const p = product.data
  const daysLeft = daysUntilExpiry(p)
  const status = statusOf(daysLeft)
  const statusBg = status === 'expired' ? palette.expiredBg : status === 'soon' ? palette.soonBg : palette.freshBg
  const statusColor = status === 'expired' ? palette.expiredText : status === 'soon' ? palette.soonText : palette.freshText
  // "Consommer un" only means something for a countable unit (pièce) —
  // a weight/volume unit (g/mL/kg/L) has no discrete "one" to decrement,
  // so the whole product leaves in one go.
  const isPieceUnit = p.quantity.unit.startsWith('pièce')
  const lastUnit = !isPieceUnit || p.quantity.amount <= 1

  return (
    <>
    <AppShell nav={{ kind: 'stack' }} hint={hint} refresh={refresh} header={header}>
      <YStack gap="$3" marginTop="$5">
        <Text fontSize={24} fontWeight="800" color={palette.ink} lineHeight={30}>
          {p.name}
        </Text>

        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <StatusChip status={status} bg={statusBg} color={statusColor} />
          <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>
            {expiryLabel(daysLeft)}
          </Text>
        </XStack>

        <YStack gap="$2" marginTop="$2">
          <DetailRow label="Quantité" value={`${p.quantity.amount} ${p.quantity.unit}`} palette={palette} />
          <DetailRow label="Emplacement" value={LOCATION_LABEL[p.location]} palette={palette} />
          <DetailRow label="Catégorie" value={p.category} palette={palette} />
          {p.expiresAt ? (
            <DetailRow label="Date de péremption" value={new Date(p.expiresAt).toLocaleDateString('fr-FR')} palette={palette} />
          ) : null}
        </YStack>

        <YStack marginTop="$5" gap="$2">
          {/* The most frequent kitchen verb had no control at all: finishing
              a product meant opening the edit form and retyping a quantity. */}
          <AuthButton
            testID="fridge-detail-consume"
            label={lastUnit ? 'J’ai fini ce produit' : 'J’en ai consommé un'}
            pendingLabel="Mise à jour..."
            pending={recordOutcome.isPending}
            icon={<CircleCheckIcon size={16} color={palette.accentLimeText} />}
            onPress={() => (isPieceUnit ? record({ kind: 'consumed', amount: 1 }) : record({ kind: 'consumed' }))}
          />

          <AuthButton
            testID="fridge-detail-edit"
            label="Modifier"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(tabs)/fridge/[id]/edit', params: { id: productId } })}
          />

          <AuthButton
            testID="fridge-detail-remove"
            label="Retirer du garde-manger"
            variant="secondary"
            onPress={() => setExiting(true)}
          />

          {actionError ? (
            <Text
              testID="fridge-detail-action-error"
              fontSize={13}
              fontWeight="600"
              color={palette.expiredText}
              accessibilityLiveRegion="polite"
            >
              {actionError}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </AppShell>
    <ProductExitSheet
      visible={exiting}
      products={[p]}
      onClose={() => setExiting(false)}
      onConsumed={() => record({ kind: 'consumed' })}
      onDiscarded={handleDiscarded}
      onCorrection={handleCorrection}
    />
    </>
  )
}

function DetailRow({ label, value, palette }: { label: string; value: string; palette: SoftPalette }) {
  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$3">
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
        {label}
      </Text>
      <Text fontSize={14} fontWeight="700" color={palette.ink} flex={1} textAlign="right">
        {value}
      </Text>
    </XStack>
  )
}
