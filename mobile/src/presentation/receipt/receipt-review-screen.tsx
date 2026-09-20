/*
 * The screen the whole "photographie ton ticket" promise lands on.
 *
 * It used to undo that promise: every extracted line rendered six text
 * inputs and a location picker, all expanded, inside one un-virtualized
 * card with no keyboard avoidance — a 20-line receipt meant 120 visible
 * text fields, more typing than adding the products by hand. There was no
 * way to drop a line the AI misread, "Réessayer" threw away the photo the
 * user had just taken, the 10-30s AI call was a single static line of
 * text, and a successful import dropped the user on a dashboard that said
 * their fridge was unchanged.
 *
 * Now: collapsed rows to approve rather than retype, per-row delete, a
 * bulk "range tout ici" control, per-field errors on the offending row,
 * retry on the same photo, and an explicit success state that says what
 * landed in the fridge.
 */
import { ConnectedPaywall } from '../settings/ai-access-cards.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'
import { useEffect, useRef, useState } from 'react'
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { ProgressBar } from '../shared/progress-bar.js'
import { FormCard } from '../shared/form-card.js'
import { AuthButton } from '../identity/auth-button.js'
import { pointerCursor } from '../shared/hover.js'
import { goBack } from '../shared/navigation.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { CalendarIcon, CircleCheckIcon, CircleXIcon, ReceiptIcon, StoreIcon, WalletIcon } from '../dashboard/dashboard-icons.js'
import { FormField } from '../fridge/form-field.js'
import { ReceiptItemRow, type EditableReceiptItem, type ReceiptItemErrors } from './receipt-item-row.js'
import { useEnqueueReceiptScanMutation, useRetryJobMutation } from '../../application/job/job-mutations.js'
import { useJobQuery } from '../../application/job/jobs.query.js'
import { useScanDraftQuery, SCAN_DRAFTS_KEY } from '../../application/job/scan-drafts.query.js'
import { useWatchJob } from '../../application/job/watched-jobs.js'
import { useImportReceiptMutation } from '../../application/receipt/import-receipt.mutation.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ReceiptDraftItem } from '../../domain/receipt/receipt-draft.js'
import type { ApiError } from '../../domain/shared/api-error.js'

const LOCATION_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

/**
 * An error is a state to act on, not a sentence to read — same contract as
 * the recipe composer's `GenerationError`. The backend already names *why*
 * the scan failed (`ApiError.type`/`.message` — see `error-serializer.ts`);
 * this used to collapse everything, from a bad photo to a missing AI-provider
 * key to the phone losing its connection, into the same one-liner
 * ("Extraction impossible, réessaie ou reprends la photo."), so a household
 * whose admin forgot to set the Gemini key saw the exact same screen as one
 * that photographed a receipt sideways — and "réessaie" was offered as if it
 * could ever fix the first case.
 */
interface ScanError {
  title: string
  message: string
  recovery: 'retry' | null
  quota?: boolean
}

function toScanError(error: ApiError): ScanError {
  // Nothing the household can do from this screen fixes a missing
  // credential — that's a `settings` change made by whoever runs the
  // instance. Offering "Réessayer" here would just repeat the same failure.
  if (error.type === 'provider_not_configured') {
    return { title: 'Extraction indisponible', message: error.message, recovery: null }
  }
  // Same reasoning as `provider_not_configured` — no retry fixes a spent
  // monthly quota, only a subscription (or next month) does.
  if (error.type === 'ai_quota_exceeded') {
    return { title: 'Quota atteint', message: error.message, recovery: null, quota: true }
  }
  if (error.type === 'network_error') {
    return { title: 'Connexion impossible', message: error.message, recovery: 'retry' }
  }
  return { title: 'Extraction impossible', message: error.message, recovery: 'retry' }
}

// Distinguishes "empty" from "invalid" from "valid" so callers can decide what
// to do with each case without `new Date(...).toISOString()` throwing on an
// unparseable string (e.g. "31/12/2026" produces an Invalid Date, and calling
// `.toISOString()` on it throws a RangeError).
function parseDateOrNull(value: string): string | null | 'invalid' {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return 'invalid'
  return date.toISOString()
}

/**
 * `scannedAt` is the ticket's own purchase date, not "today" — a receipt
 * reviewed a week after the shopping trip should still count shelf life
 * from when the food was actually bought. `null` when the AI had no
 * estimate for this item, or the ticket's own date failed to parse.
 */
function estimateExpiresAt(scannedAt: string, expiresInDays: number | null): string | null {
  if (expiresInDays === null) return null
  const scanned = new Date(scannedAt)
  if (Number.isNaN(scanned.getTime())) return null
  const expires = new Date(scanned)
  expires.setUTCDate(expires.getUTCDate() + expiresInDays)
  return expires.toISOString().slice(0, 10)
}

function toEditable(item: ReceiptDraftItem, scannedAt: string): EditableReceiptItem {
  const estimated = estimateExpiresAt(scannedAt, item.expiresInDays)
  return {
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit,
    category: item.category ?? '',
    price: item.price !== null ? String(item.price) : '',
    location: 'fridge',
    // A pre-filled guess, not a fact — still just as editable as every other
    // extracted field, and `expiresAtEstimated` fades once the household
    // types over it (see `receipt-item-row.tsx`).
    expiresAt: estimated ?? '',
    expiresAtEstimated: estimated !== null,
  }
}

/**
 * Three ways in, one screen: `imageUri` (fresh from the scanner — enqueues the
 * scan), `jobId` (a scan already running, re-opened from the task center) or
 * `draftId` (a finished scan, re-opened from a toast or the dashboard banner).
 * The scan itself runs on the server, so leaving this screen never loses it.
 */
export function ReceiptReviewScreen({
  imageUri,
  jobId: jobIdParam,
  draftId: draftIdParam,
}: {
  imageUri?: string
  jobId?: string
  draftId?: string
}) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const enqueueScan = useEnqueueReceiptScanMutation()
  const retryJob = useRetryJobMutation()
  const { canSubscribe } = useAiSubscribe()
  const importReceipt = useImportReceiptMutation()
  const nav = { kind: 'stack' as const }
  const { isWide, hasMobileNav } = useAppShellLayout(nav)

  const [storeName, setStoreName] = useState('')
  const [scannedAt, setScannedAt] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [items, setItems] = useState<EditableReceiptItem[]>([])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<number, ReceiptItemErrors>>({})
  const [enqueueError, setEnqueueError] = useState<ScanError | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [imported, setImported] = useState<number | null>(null)
  const [jobId, setJobId] = useState<string | undefined>(jobIdParam)
  const startedRef = useRef(false)
  const seededRef = useRef(false)

  const job = useJobQuery(jobId).data ?? null
  useWatchJob(jobId)
  const draftId = draftIdParam ?? job?.result?.draftId
  const draft = useScanDraftQuery(draftId).data ?? null

  async function runScan() {
    if (!imageUri) return
    setEnqueueError(null)
    const result = await enqueueScan.mutateAsync(imageUri)
    if (!result.ok) {
      setEnqueueError(toScanError(result.error))
      return
    }
    setJobId(result.value.id)
    // A remount (navigation, fast refresh) must find the job, not the photo — else it would enqueue twice.
    router.setParams({ jobId: result.value.id, imageUri: undefined })
  }

  useEffect(() => {
    if (startedRef.current || jobIdParam || draftIdParam) return
    startedRef.current = true
    runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Seeds the editable form once, from the server draft — later polls must not clobber the member's edits.
  useEffect(() => {
    if (seededRef.current || !draft || draft.kind !== 'receipt') return
    seededRef.current = true
    setStoreName(draft.draft.storeName)
    setScannedAt(draft.draft.scannedAt.slice(0, 10))
    setTotalAmount(String(draft.draft.totalAmount))
    setItems(draft.draft.items.map((item) => toEditable(item, draft.draft.scannedAt)))
  }, [draft])

  const scanError: ScanError | null =
    enqueueError ??
    (job?.status === 'failed' && job.error ? toScanError(job.error) : null)
  const scanPending = !scanError && !draft && (enqueueScan.isPending || Boolean(jobId) || Boolean(draftId))

  function retryScan() {
    if (job?.status === 'failed') retryJob.mutate(job.id)
    else runScan()
  }

  function updateItem(index: number, next: EditableReceiptItem) {
    setItems((current) => current.map((item, i) => (i === index ? next : item)))
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index))
    setItemErrors({})
    setExpandedIndex((current) => (current === index ? null : current !== null && current > index ? current - 1 : current))
  }

  function setAllLocations(location: LocationValue) {
    setItems((current) => current.map((item) => ({ ...item, location })))
  }

  /** Collects every bad field instead of aborting on the first one. */
  function validate() {
    const errors: Record<number, ReceiptItemErrors> = {}
    const parsed: {
      name: string
      quantity: number
      unit: string
      category: string | null
      price: number | null
      location: LocationValue
      expiresAt: string | null
    }[] = []

    items.forEach((item, index) => {
      const rowErrors: ReceiptItemErrors = {}

      if (item.name.trim().length === 0) rowErrors.name = 'Donne un nom à cet article.'

      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) rowErrors.quantity = 'Quantité invalide.'

      let price: number | null = null
      if (item.price.trim().length > 0) {
        price = Number(item.price)
        if (!Number.isFinite(price) || price <= 0) rowErrors.price = 'Prix invalide.'
      }

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
        price,
        location: item.location,
        expiresAt: expiresAt as string | null,
      })
    })

    return { errors, parsed }
  }

  async function handleSubmit() {
    setSubmitError(null)
    setItemErrors({})

    if (items.length === 0) {
      setSubmitError('Ajoute au moins un article avant d’importer.')
      return
    }

    const parsedTotalAmount = Number(totalAmount)
    if (!Number.isFinite(parsedTotalAmount) || parsedTotalAmount <= 0) {
      setSubmitError('Le montant total doit être positif.')
      return
    }

    const parsedScannedAt = parseDateOrNull(scannedAt)
    if (parsedScannedAt === 'invalid') {
      setSubmitError('Date du ticket invalide (attendu AAAA-MM-JJ).')
      return
    }

    const { errors, parsed } = validate()
    const badIndexes = Object.keys(errors).map(Number)
    if (badIndexes.length > 0) {
      setItemErrors(errors)
      // Open the first offending row: an error you cannot see is an error
      // you cannot fix, and the row is collapsed by default.
      setExpandedIndex(badIndexes[0])
      setSubmitError(
        badIndexes.length === 1
          ? 'Un article est à corriger.'
          : `${badIndexes.length} articles sont à corriger.`,
      )
      return
    }

    const result = await importReceipt.mutateAsync({
      draftId: draft?.id,
      storeName: storeName.trim(),
      scannedAt: parsedScannedAt ?? new Date().toISOString(),
      totalAmount: parsedTotalAmount,
      items: parsed,
    })

    if (!result.ok) {
      setSubmitError(
        result.error.type === 'validation_failed'
          ? 'Certains champs sont invalides. Vérifie les articles.'
          : result.error.message,
      )
      return
    }

    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['receipts'] })
    queryClient.invalidateQueries({ queryKey: SCAN_DRAFTS_KEY })
    setImported(result.value.products.length)
  }

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <ReceiptIcon size={19} color={color} />}
      title="Vérifier le ticket"
      subtitle={
        items.length > 0 && imported === null
          ? `${items.length} article${items.length > 1 ? 's' : ''} extrait${items.length > 1 ? 's' : ''} — corrige ce qui cloche, le reste part tel quel.`
          : undefined
      }
      onBack={() => goBack('/receipts')}
    />
  )

  if (imported !== null) {
    return (
      <AppShell nav={nav} header={header}>
        {/* Buttons pinned to the bottom of the screen, not to wherever the
            message happens to end — the outer `flex:1` fills AppShell's
            scroll area (its `contentContainerStyle` carries `flexGrow:1`
            for exactly this), the icon/text block centers in what's left,
            and the buttons rest at the very bottom: the thumb-reachable
            zone, on any phone, regardless of how short the message is. */}
        <YStack flex={1} minHeight={0} alignItems="center">
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" paddingTop="$6">
            <YStack width={64} height={64} borderRadius={999} backgroundColor={palette.freshBg} alignItems="center" justifyContent="center">
              <CircleCheckIcon size={30} color={palette.freshText} />
            </YStack>
            <Text testID="receipt-review-success" fontSize={20} fontWeight="800" color={palette.ink} textAlign="center">
              {imported} produit{imported > 1 ? 's' : ''} ajouté{imported > 1 ? 's' : ''} au garde-manger
            </Text>
            <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
              Ton foyer les voit déjà.
            </Text>
          </YStack>
          <YStack width="100%" gap="$2" paddingBottom="$2">
            <AuthButton
              testID="receipt-review-open-fridge"
              label="Voir le garde-manger"
              onPress={() => router.replace('/(tabs)/fridge')}
            />
            <AuthButton
              testID="receipt-review-scan-another"
              label="Scanner un autre ticket"
              variant="secondary"
              onPress={() => router.replace('/receipts/scan')}
            />
          </YStack>
        </YStack>
      </AppShell>
    )
  }

  if (scanPending && items.length === 0) {
    return (
      <AppShell nav={nav} header={header}>
        <YStack alignItems="center" gap="$3" marginTop="$8">
          {/* The photo itself, small — the same trust the review list gives
              the shot below (see its own comment): the wait is legible as
              "reading *this* ticket", not a generic spinner. Only there when
              the scan was started from this screen: a re-opened one has no
              local photo. */}
          {imageUri ? (
            <Image
              testID="receipt-reading-photo"
              source={{ uri: imageUri }}
              resizeMode="cover"
              accessibilityLabel="Photo du ticket en cours de lecture"
              style={{
                width: 96,
                height: 96,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 10,
                borderBottomRightRadius: 22,
                borderBottomLeftRadius: 10,
                backgroundColor: palette.cream,
              }}
            />
          ) : null}
          <YStack width="100%" maxWidth={280}>
            <ProgressBar palette={palette} testID="receipt-reading-bar" label="Lecture du ticket en cours" />
          </YStack>
          <Text fontSize={15} fontWeight="700" color={palette.ink}>
            {job?.status === 'queued' ? 'En attente…' : 'Lecture du ticket…'}
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
            L’IA lit chaque ligne de ta photo. Ça prend en général une dizaine de secondes — tu peux faire autre chose, on te prévient.
          </Text>
          <AuthButton
            testID="receipt-review-later"
            label="Je reviens plus tard"
            variant="secondary"
            onPress={() => router.replace('/(tabs)')}
          />
        </YStack>
      </AppShell>
    )
  }

  if (scanError) {
    return (
      <AppShell nav={nav} header={header}>
        {/* Same shape as the success state above (circle + title + body),
            coral instead of lime — icon AND colour AND word, this system's
            status language, not a bare line of red text. Buttons pinned to
            the bottom of the screen for the same reason as the success
            state: the thumb-reachable zone, not wherever the message ends. */}
        <YStack flex={1} minHeight={0} alignItems="center">
          {scanError.quota && canSubscribe ? (
            <YStack flex={1} width="100%" justifyContent="center" paddingTop="$6">
              <ConnectedPaywall palette={palette} reason="Quota gratuit atteint" />
            </YStack>
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" paddingTop="$6">
              <YStack width={64} height={64} borderRadius={999} backgroundColor={palette.expiredBg} alignItems="center" justifyContent="center">
                <CircleXIcon size={30} color={palette.expiredText} />
              </YStack>
              <Text testID="receipt-scan-error-title" fontSize={17} fontWeight="800" color={palette.ink} textAlign="center">
                {scanError.title}
              </Text>
              {/* The backend's own message — what actually failed (a bad photo,
                  a missing AI-provider key, an unreachable server), not one
                  catch-all sentence for every cause. */}
              <Text
                testID="receipt-scan-error"
                fontSize={13}
                fontWeight="500"
                color={palette.inkSecondary}
                textAlign="center"
                maxWidth={320}
                accessibilityLiveRegion="polite"
              >
                {scanError.message}
              </Text>
            </YStack>
          )}
          <YStack width="100%" gap="$2" paddingBottom="$2">
            {/* Retry re-reads the same photo. It used to route back to the
                camera, throwing away the shot the user had just framed — and
                it used to show unconditionally, even when the cause (no AI
                provider configured) guarantees a second identical failure. */}
            {scanError.recovery === 'retry' ? (
              <AuthButton
                testID="receipt-review-retry"
                label="Réessayer"
                pendingLabel="Lecture..."
                pending={enqueueScan.isPending || retryJob.isPending}
                onPress={retryScan}
              />
            ) : null}
            <AuthButton
              testID="receipt-review-retake"
              label="Reprendre la photo"
              variant="secondary"
              onPress={() => router.replace('/receipts/scan')}
            />
          </YStack>
        </YStack>
      </AppShell>
    )
  }

  const listHeader = (
    <YStack gap="$4" marginBottom="$2">
      {/* The shot itself: the user has to be able to check a line against
          the paper it came from. It was passed in and never displayed. */}
      {imageUri ? (
        <Image
          testID="receipt-review-photo"
          source={{ uri: imageUri }}
          resizeMode="cover"
          accessibilityLabel="Photo du ticket scanné"
          style={{
            width: '100%',
            height: 140,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 24,
            borderBottomLeftRadius: 14,
            backgroundColor: palette.cream,
          }}
        />
      ) : null}
      <FormCard palette={palette} gap="$3">
        <FormField
          testID="receipt-review-store-name"
          label="Magasin"
          value={storeName}
          onChangeText={setStoreName}
          palette={palette}
          icon={(color) => <StoreIcon size={13} color={color} />}
        />
        <XStack gap="$2">
          <YStack flex={1}>
            <FormField
              testID="receipt-review-scanned-at"
              label="Date du ticket"
              value={scannedAt}
              onChangeText={setScannedAt}
              palette={palette}
              keyboardType="numbers-and-punctuation"
              placeholder="AAAA-MM-JJ"
              icon={(color) => <CalendarIcon size={13} color={color} />}
            />
          </YStack>
          <YStack flex={1}>
            <FormField
              testID="receipt-review-total-amount"
              label="Total (€)"
              value={totalAmount}
              onChangeText={setTotalAmount}
              palette={palette}
              keyboardType="decimal-pad"
              icon={(color) => <WalletIcon size={13} color={color} />}
            />
          </YStack>
        </XStack>
      </FormCard>

      <YStack gap="$2">
        <Text fontSize={12} fontWeight="700" color={palette.inkSecondary}>
          Tout ranger dans
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {LOCATIONS.map((location) => (
            <Pressable
              key={location}
              testID={`receipt-review-all-${location}`}
              onPress={() => setAllLocations(location)}
              accessibilityRole="button"
              accessibilityLabel={`Ranger tous les articles dans ${LOCATION_LABELS[location]}`}
              style={pointerCursor}
            >
              <XStack alignItems="center" minHeight={44} paddingHorizontal="$4" borderRadius={999} backgroundColor={palette.cream}>
                <Text fontSize={13} fontWeight="700" color={palette.creamText}>
                  {LOCATION_LABELS[location]}
                </Text>
              </XStack>
            </Pressable>
          ))}
        </XStack>
      </YStack>
    </YStack>
  )

  const listFooter = (
    <YStack gap="$2" marginTop="$3">
      {submitError ? (
        <Text
          testID="receipt-review-error"
          fontSize={13}
          fontWeight="600"
          color={palette.expiredText}
          accessibilityLiveRegion="polite"
        >
          {submitError}
        </Text>
      ) : null}
      <AuthButton
        testID="receipt-review-submit"
        label={items.length > 0 ? `Importer ${items.length} article${items.length > 1 ? 's' : ''}` : 'Importer'}
        pendingLabel="Importation..."
        pending={importReceipt.isPending}
        onPress={handleSubmit}
      />
    </YStack>
  )

  return (
    <AppShell nav={nav} scrollable={false} header={header}>
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Virtualized: a long receipt is a long list, and it used to render
            every row's seven controls at once inside a plain ScrollView. */}
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
            <ReceiptItemRow
              index={index}
              item={item}
              expanded={expandedIndex === index}
              onToggle={() => setExpandedIndex((current) => (current === index ? null : index))}
              onChange={(next) => updateItem(index, next)}
              onRemove={() => removeItem(index)}
              errors={itemErrors[index]}
            />
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
        Aucun article sur ce ticket
      </Text>
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
        L’IA n’a rien reconnu, ou tu as tout retiré. Reprends la photo en cadrant le ticket entier.
      </Text>
    </YStack>
  )
}
