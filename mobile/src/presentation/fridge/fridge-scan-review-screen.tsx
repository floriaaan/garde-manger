/**
 * Per-photo progress while the scans run, then a merged, de-duplicated list
 * to approve — same "approve, don't retype" contract as
 * `receipt-review-screen.tsx`, reusing its row component (`showPrice`
 * false: the fridge scan has no price to show or edit).
 */
import { ConnectedPaywall } from '../settings/ai-access-cards.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'
import { useState } from 'react'
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { PulseDots } from '../shared/pulse-dots.js'
import { AuthButton } from '../identity/auth-button.js'
import { pointerCursor } from '../shared/hover.js'
import { goBack } from '../shared/navigation.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { CameraIcon, CircleCheckIcon, CircleXIcon, TriangleAlertIcon } from '../dashboard/dashboard-icons.js'
import { ReceiptItemRow, type EditableReceiptItem, type ReceiptItemErrors } from '../receipt/receipt-item-row.js'
import { useFridgeScan } from '../../application/fridge/use-fridge-scan.js'
import { useImportProductsMutation } from '../../application/fridge/import-products.mutation.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { isLikelyDuplicate } from '../../domain/fridge/fridge-scan-merge.js'
import type { FridgeScanDraftItem, ImportProductsItemInput } from '../../domain/fridge/fridge-scan-draft.js'

interface EditableFridgeItem extends EditableReceiptItem {
  included: boolean
  duplicate: boolean
}

function estimateExpiresAt(expiresInDays: number | null): string | null {
  if (expiresInDays === null) return null
  const expires = new Date()
  expires.setUTCDate(expires.getUTCDate() + expiresInDays)
  return expires.toISOString().slice(0, 10)
}

function toEditable(item: FridgeScanDraftItem, duplicate: boolean): EditableFridgeItem {
  const estimated = estimateExpiresAt(item.expiresInDays)
  return {
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit,
    category: item.category ?? '',
    price: '',
    location: item.location,
    expiresAt: estimated ?? '',
    expiresAtEstimated: estimated !== null,
    included: !duplicate,
    duplicate,
  }
}

function parseDateOrNull(value: string): string | null | 'invalid' {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return 'invalid'
  return date.toISOString()
}

export function FridgeScanReviewScreen({ imageUris }: { imageUris: string[] }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const scan = useFridgeScan(imageUris)
  const { canSubscribe } = useAiSubscribe()
  const existingProducts = useProductsQuery()
  const importProducts = useImportProductsMutation()
  const nav = { kind: 'stack' as const }
  const { isWide, hasMobileNav } = useAppShellLayout(nav)

  const [items, setItems] = useState<EditableFridgeItem[]>([])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<number, ReceiptItemErrors>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [imported, setImported] = useState<number | null>(null)

  // Reseeds the editable list whenever the merged draft changes (a retried
  // photo lands), adjusting state during render rather than in an effect —
  // React's documented pattern, one render instead of two. `scan.items` is
  // memoized, so this runs once per change, never per render.
  const [seededFrom, setSeededFrom] = useState<typeof scan.items | null>(null)
  if (scan.done && seededFrom !== scan.items) {
    const existing = existingProducts.data ?? []
    setSeededFrom(scan.items)
    setItems(scan.items.map((item) => toEditable(item, isLikelyDuplicate(item, existing))))
  }

  function updateItem(index: number, next: EditableFridgeItem) {
    setItems((current) => current.map((item, i) => (i === index ? next : item)))
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index))
    setItemErrors({})
    setExpandedIndex((current) => (current === index ? null : current !== null && current > index ? current - 1 : current))
  }

  function validate() {
    const errors: Record<number, ReceiptItemErrors> = {}
    const parsed: ImportProductsItemInput[] = []

    items.forEach((item, index) => {
      if (!item.included) return
      const rowErrors: ReceiptItemErrors = {}

      if (item.name.trim().length === 0) rowErrors.name = 'Donne un nom à cet article.'

      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) rowErrors.quantity = 'Quantité invalide.'

      const expiresAt = parseDateOrNull(item.expiresAt)
      if (expiresAt === 'invalid') rowErrors.expiresAt = 'Date invalide (AAAA-MM-JJ).'

      if (Object.keys(rowErrors).length > 0) {
        errors[index] = rowErrors
        return
      }

      parsed.push({
        name: item.name.trim(),
        quantity,
        unit: item.unit.trim(),
        category: item.category.trim().length > 0 ? item.category.trim() : null,
        location: item.location,
        expiresAt: expiresAt as string | null,
      })
    })

    return { errors, parsed }
  }

  async function handleSubmit() {
    setSubmitError(null)
    setItemErrors({})

    const included = items.filter((item) => item.included)
    if (included.length === 0) {
      setSubmitError('Inclus au moins un produit avant d’importer.')
      return
    }

    const { errors, parsed } = validate()
    const badIndexes = Object.keys(errors).map(Number)
    if (badIndexes.length > 0) {
      setItemErrors(errors)
      setExpandedIndex(badIndexes[0])
      setSubmitError(badIndexes.length === 1 ? 'Un produit est à corriger.' : `${badIndexes.length} produits sont à corriger.`)
      return
    }

    const result = await importProducts.mutateAsync(parsed)
    if (!result.ok) {
      setSubmitError(result.error.type === 'validation_failed' ? 'Certains champs sont invalides. Vérifie les produits.' : result.error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['products'] })
    setImported(result.value.products.length)
  }

  const includedCount = items.filter((item) => item.included).length

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <CameraIcon size={19} color={color} />}
      title="Vérifier le frigo"
      subtitle={
        scan.done && items.length > 0 && imported === null
          ? `${items.length} produit${items.length > 1 ? 's' : ''} détecté${items.length > 1 ? 's' : ''} — touche-en un pour le corriger`
          : undefined
      }
      onBack={() => goBack('/(tabs)/scan')}
    />
  )

  if (imported !== null) {
    return (
      <AppShell nav={nav} header={header}>
        <YStack flex={1} minHeight={0} alignItems="center">
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" paddingTop="$6">
            <YStack width={64} height={64} borderRadius={999} backgroundColor={palette.freshBg} alignItems="center" justifyContent="center">
              <CircleCheckIcon size={30} color={palette.freshText} />
            </YStack>
            <Text testID="fridge-scan-review-success" fontSize={20} fontWeight="800" color={palette.ink} textAlign="center">
              {imported} produit{imported > 1 ? 's' : ''} ajouté{imported > 1 ? 's' : ''} au garde-manger
            </Text>
          </YStack>
          <YStack width="100%" gap="$2" paddingBottom="$2">
            <AuthButton testID="fridge-scan-review-open-fridge" label="Voir le garde-manger" onPress={() => router.replace('/(tabs)/fridge')} />
          </YStack>
        </YStack>
      </AppShell>
    )
  }

  if (scan.blockedByProvider) {
    const providerError = scan.states.find(
      (s) => s.status === 'failed' && (s.error.type === 'provider_not_configured' || s.error.type === 'ai_quota_exceeded'),
    )
    const quotaExceeded = providerError?.status === 'failed' && providerError.error.type === 'ai_quota_exceeded'
    return (
      <AppShell nav={nav} header={header}>
        {quotaExceeded && canSubscribe ? (
          <YStack flex={1} justifyContent="center">
            <ConnectedPaywall palette={palette} reason="Quota gratuit atteint" />
          </YStack>
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
            <YStack width={64} height={64} borderRadius={999} backgroundColor={palette.expiredBg} alignItems="center" justifyContent="center">
              <TriangleAlertIcon size={30} color={palette.expiredText} />
            </YStack>
            <Text testID="fridge-scan-blocked-title" fontSize={17} fontWeight="800" color={palette.ink} textAlign="center">
              {quotaExceeded ? 'Quota atteint' : 'Extraction indisponible'}
            </Text>
            <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center" maxWidth={320}>
              {providerError && providerError.status === 'failed' ? providerError.error.message : ''}
            </Text>
          </YStack>
        )}
      </AppShell>
    )
  }

  if (!scan.done) {
    const settled = scan.states.filter((s) => s.status === 'done' || s.status === 'failed').length
    return (
      <AppShell nav={nav} header={header}>
        <YStack alignItems="center" gap="$4" marginTop="$8">
          {/* Every photo, each carrying its own state: the wait is per photo,
              so is the progress — a failed shot shows up here, not only
              once the whole batch has landed. */}
          <XStack testID="fridge-scan-reading-photos" gap="$2.5" flexWrap="wrap" justifyContent="center">
            {imageUris.map((uri, index) => (
              <PhotoProgress key={uri} uri={uri} state={scan.states[index]?.status ?? 'pending'} palette={palette} />
            ))}
          </XStack>
          <PulseDots palette={palette} size={12} testID="fridge-scan-reading-dots" label="Lecture des photos en cours" />
          <YStack alignItems="center" gap="$1">
            <Text fontSize={17} fontWeight="800" color={palette.ink}>
              L’IA fait l’inventaire…
            </Text>
            <Text testID="fridge-scan-progress" fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
              {settled} / {scan.states.length} photos analysées
            </Text>
          </YStack>
        </YStack>
      </AppShell>
    )
  }

  const failedCount = scan.states.filter((s) => s.status === 'failed').length

  const listHeader = (
    <YStack gap="$3" marginBottom="$2">
      {failedCount > 0 ? (
        <YStack backgroundColor={palette.expiredBg} borderRadius={14} padding="$3" gap="$2">
          <Text fontSize={13} fontWeight="700" color={palette.expiredText}>
            {failedCount} photo{failedCount > 1 ? 's' : ''} sur {scan.states.length} n’a pas pu être analysée{failedCount > 1 ? 's' : ''}.
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {scan.states.map((s, index) =>
              s.status === 'failed' ? (
                <Pressable
                  key={index}
                  testID={`fridge-scan-retry-${index}`}
                  onPress={() => scan.retry(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Réessayer la photo ${index + 1}`}
                  style={pointerCursor}
                >
                  <XStack alignItems="center" minHeight={36} paddingHorizontal="$3" borderRadius={999} backgroundColor={palette.cream}>
                    <Text fontSize={12} fontWeight="700" color={palette.creamText}>
                      Réessayer la photo {index + 1}
                    </Text>
                  </XStack>
                </Pressable>
              ) : null,
            )}
          </XStack>
        </YStack>
      ) : null}
      <XStack gap="$2.5" flexWrap="wrap">
        {imageUris.map((uri, index) => (
          <PhotoProgress key={uri} uri={uri} state={scan.states[index]?.status ?? 'pending'} palette={palette} size={56} />
        ))}
      </XStack>
    </YStack>
  )

  const listFooter = (
    <YStack gap="$2" marginTop="$3">
      {submitError ? (
        <Text testID="fridge-scan-review-error" fontSize={13} fontWeight="600" color={palette.expiredText} accessibilityLiveRegion="polite">
          {submitError}
        </Text>
      ) : null}
      <AuthButton
        testID="fridge-scan-review-submit"
        label={includedCount > 0 ? `Ajouter ${includedCount} produit${includedCount > 1 ? 's' : ''}` : 'Ajouter'}
        pendingLabel="Importation..."
        pending={importProducts.isPending}
        onPress={handleSubmit}
      />
    </YStack>
  )

  return (
    <AppShell nav={nav} scrollable={false} header={header}>
      <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={items}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={shellContentStyle({ isWide, hasMobileNav })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={<EmptyItems palette={palette} />}
          renderItem={({ item, index }) => (
            <YStack gap="$1">
              {item.duplicate ? (
                <XStack alignItems="center" gap="$2">
                  <Pressable
                    testID={`fridge-scan-item-${index}-include`}
                    onPress={() => updateItem(index, { ...item, included: !item.included })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.included }}
                    accessibilityLabel={item.included ? 'Ne pas ajouter ce produit' : 'Ajouter quand même ce produit'}
                    style={pointerCursor}
                  >
                    <XStack alignItems="center" gap="$1.5" minHeight={32} paddingHorizontal="$3" borderRadius={999} backgroundColor={palette.soonBg}>
                      <TriangleAlertIcon size={13} color={palette.soonText} />
                      <Text fontSize={12} fontWeight="700" color={palette.soonText}>
                        {item.included ? 'Déjà au frigo · ajouté quand même' : 'Déjà au frigo · touche pour l’ajouter'}
                      </Text>
                    </XStack>
                  </Pressable>
                </XStack>
              ) : null}
              <YStack opacity={item.included ? 1 : 0.5}>
                <ReceiptItemRow
                  index={index}
                  item={item}
                  expanded={expandedIndex === index}
                  onToggle={() => setExpandedIndex((current) => (current === index ? null : index))}
                  onChange={(next) => updateItem(index, { ...item, ...next })}
                  onRemove={() => removeItem(index)}
                  errors={itemErrors[index]}
                  showPrice={false}
                />
              </YStack>
            </YStack>
          )}
        />
      </KeyboardAvoidingView>
    </AppShell>
  )
}

function EmptyItems({ palette }: { palette: SoftPalette }) {
  return (
    <YStack gap="$2" paddingVertical="$4">
      <Text fontSize={14} fontWeight="700" color={palette.ink}>
        Aucun produit détecté
      </Text>
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
        L’IA n’a rien reconnu sur ces photos. Reprends-en en cadrant bien l’intérieur du frigo.
      </Text>
    </YStack>
  )
}

function PhotoProgress({
  uri,
  state,
  palette,
  size = 72,
}: {
  uri: string
  state: 'pending' | 'running' | 'done' | 'failed'
  palette: SoftPalette
  size?: number
}) {
  return (
    <YStack opacity={state === 'pending' ? 0.45 : 1}>
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={{ width: size, height: size, borderRadius: 14, backgroundColor: palette.cream }}
      />
      {state === 'done' || state === 'failed' ? (
        <YStack
          position="absolute"
          top={-6}
          right={-6}
          width={24}
          height={24}
          borderRadius={999}
          backgroundColor={state === 'done' ? palette.freshBg : palette.expiredBg}
          alignItems="center"
          justifyContent="center"
          accessibilityLabel={state === 'done' ? 'Photo analysée' : 'Photo non analysée'}
        >
          {state === 'done' ? <CircleCheckIcon size={15} color={palette.freshText} /> : <CircleXIcon size={15} color={palette.expiredText} />}
        </YStack>
      ) : null}
    </YStack>
  )
}
