import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/index.js'
import type { Product } from '../../domain/fridge/product.js'
import type { RecordProductOutcomeInput } from '../../domain/fridge/product-outcome.js'
import { Quantity } from '../../domain/fridge/quantity.js'
import { normalizeShoppingItemName } from '../../domain/shopping-list/shopping-item-merge.js'
import { useShoppingItemsQuery } from '../../application/shopping-list/shopping-items.query.js'
import { useCreateShoppingItemMutation } from '../../application/shopping-list/create-shopping-item.mutation.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AuthButton } from '../identity/auth-button.js'
import { AuthField } from '../identity/auth-field.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/** Mount for one decision, unmount on close. Shared by the fiche and long-press actions. */
export function ProductRestockSheet({
  product,
  finish,
  onClose,
  onFinish,
  onComplete,
}: {
  product: Product
  finish: boolean
  onClose: () => void
  onFinish: (inShoppingList: boolean, input: RecordProductOutcomeInput) => Promise<boolean>
  onComplete: (inShoppingList: boolean) => void
}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const items = useShoppingItemsQuery({ retry: false })
  const createItem = useCreateShoppingItemMutation()
  const reference = product.initialQuantity ?? product.quantity.amount
  const [amount, setAmount] = useState(String(reference > 0 ? reference : 1))
  const [unit, setUnit] = useState(product.quantity.unit.trim() || t('fridge.item'))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [inShoppingList, setInShoppingList] = useState(false)
  // Freeze the consumption intent, including its receipt key, when the
  // decision opens. Refetches and retries must not consume newly added stock.
  const [consumption] = useState<RecordProductOutcomeInput>(() => ({
    kind: 'consumed',
    amount: product.quantity.amount,
    operationId: `restock-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
  }))
  // A synchronous guard covers two presses before React commits disabled.
  const busy = useRef(false)
  const completed = useRef(false)
  const existing = items.data?.find(
    (item) =>
      !item.checked &&
      normalizeShoppingItemName(item.name) === normalizeShoppingItemName(product.name),
  )
  const [existingId, setExistingId] = useState<string | undefined>(undefined)
  if (existing?.id !== existingId && !inShoppingList) {
    setExistingId(existing?.id)
    if (existing) {
      setAmount(String(existing.quantity.amount))
      setUnit(existing.quantity.unit)
    }
  }

  async function submit(action: 'add' | 'keep' | 'finish-only') {
    if (busy.current || completed.current) return
    busy.current = true
    setPending(true)
    setError(null)
    let saved = inShoppingList
    try {
      if (action !== 'finish-only' && !saved) {
        if (!items.isSuccess || items.isFetching) return
        const quantity =
          action === 'keep' && existing
            ? Quantity.create(existing.quantity.amount, existing.quantity.unit)
            : Quantity.create(Number(amount), unit)
        if (!quantity.ok) {
          setError(quantity.error.message)
          return
        }
        const result = await createItem.mutateAsync({
          name: product.name,
          quantity: quantity.value,
          source: 'manual',
          onDuplicate: existing ? (action === 'keep' ? 'keep' : 'replace') : 'reject',
          existingItemId: existing?.id,
        })
        if (!result.ok) {
          setError(result.error.message)
          // A member (or a timed-out previous request) may have added it
          // since the read. Refresh and require a new, explicit decision.
          await items.refetch()
          return
        }
        saved = true
        setInShoppingList(true)
        void queryClient.invalidateQueries({ queryKey: ['shopping-items'] })
      }
      // Shopping first: failure cannot remove inventory. If consumption
      // fails, saved stays true and retry never adds to shopping again.
      if (finish && !(await onFinish(saved, consumption))) {
        setError(t(saved ? 'restock.finish_failed_after_add' : 'restock.finish_failed'))
        return
      }
      completed.current = true
      onComplete(saved)
    } catch {
      setError(t(saved ? 'restock.finish_failed_after_add' : 'restock.request_failed'))
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const unavailable = !inShoppingList && (!items.isSuccess || items.isFetching)
  return (
    <ActionSheet
      visible
      dismissible={!pending}
      onClose={() => {
        if (!busy.current) onClose()
      }}
      title={t(finish ? 'restock.finish_title' : 'restock.add_title')}
      description={t('restock.household_list', { name: product.name })}
      options={[]}
    >
      <YStack gap="$3">
        {inShoppingList ? (
          <Text accessibilityLiveRegion="polite" fontSize={14} color={palette.freshText}>
            {t('restock.shopping_saved')}
          </Text>
        ) : (
          <>
            {existing ? (
              <Text testID="restock-existing" fontSize={14} fontWeight="700" color={palette.ink}>
                {t('restock.already_present', {
                  amount: existing.quantity.amount,
                  unit: existing.quantity.unit,
                })}
              </Text>
            ) : null}
            <AuthField
              testID="restock-amount"
              label={t(existing ? 'restock.total_quantity' : 'restock.quantity')}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              editable={!pending}
            />
            <AuthField
              testID="restock-unit"
              label={t('restock.unit')}
              value={unit}
              onChangeText={setUnit}
              editable={!pending}
            />
          </>
        )}
        {items.isError && !inShoppingList ? (
          <>
            <Text fontSize={13} color={palette.expiredText} accessibilityRole="alert">
              {t('restock.list_failed')}
            </Text>
            <AuthButton
              testID="restock-reload"
              variant="secondary"
              label={t('restock.retry_list')}
              onPress={() => {
                void items.refetch()
              }}
            />
          </>
        ) : null}
        {error ? (
          <Text
            testID="restock-error"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            fontSize={13}
            color={palette.expiredText}
          >
            {error}
          </Text>
        ) : null}
        <AuthButton
          testID="restock-confirm"
          label={t(
            inShoppingList
              ? 'restock.retry_finish'
              : finish
                ? 'restock.finish_and_add'
                : existing
                  ? 'restock.save_quantity'
                  : 'restock.add',
          )}
          pendingLabel={t('restock.saving')}
          pending={pending}
          disabled={unavailable}
          onPress={() => {
            void submit('add')
          }}
        />
        {existing && !inShoppingList ? (
          <AuthButton
            testID="restock-keep"
            variant="secondary"
            disabled={pending || unavailable}
            label={t(finish ? 'restock.finish_and_keep' : 'restock.keep_existing')}
            onPress={() => {
              void submit('keep')
            }}
          />
        ) : null}
        {finish && !inShoppingList ? (
          <AuthButton
            testID="restock-finish-only"
            variant="secondary"
            disabled={pending}
            label={t('restock.finish_only')}
            onPress={() => {
              void submit('finish-only')
            }}
          />
        ) : null}
      </YStack>
    </ActionSheet>
  )
}
