import { LayoutAnimation, Pressable } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useReduceMotion } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { CircleCheckIcon, ChevronRightIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { daysUntilExpiry, expiryLabel } from '../dashboard/product-status.js'
import type { EditableReceiptItem, ReceiptItemErrors } from '../receipt/receipt-item-row.js'
import { ProductFields, type ProductFieldValues } from './product-fields.js'

export interface EditableFridgeItem extends EditableReceiptItem {
  included: boolean
  duplicate: boolean
}

/**
 * One detected product: a check to keep or drop it, a summary line, and — one
 * tap away — the same fields as the manual product form. Collapsed, a
 * twenty-product scan is twenty lines to approve, not twenty forms.
 */
export function FridgeScanItemRow({
  index,
  item,
  expanded,
  onToggleExpanded,
  onChange,
  onRemove,
  errors,
}: {
  index: number
  item: EditableFridgeItem
  expanded: boolean
  onToggleExpanded: () => void
  onChange: (item: EditableFridgeItem) => void
  onRemove: () => void
  errors?: ReceiptItemErrors
}) {
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const hasError = Boolean(errors && Object.keys(errors).length > 0)
  const expiryDays = item.expiresAt.trim().length > 0 ? daysUntilExpiry({ expiresAt: item.expiresAt.trim() }) : null
  const summary = [
    item.quantity.trim().length > 0 ? `${item.quantity} ${item.unit}`.trim() : null,
    expiryDays !== null ? `${expiryLabel(expiryDays)}${item.expiresAtEstimated ? ' · estimée' : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const values: ProductFieldValues = {
    name: item.name,
    amount: item.quantity,
    unit: item.unit,
    expiresAt: item.expiresAt,
    location: item.location,
  }

  function patch(next: Partial<ProductFieldValues>) {
    const { amount, ...rest } = next
    onChange({
      ...item,
      ...rest,
      ...(amount !== undefined ? { quantity: amount } : null),
      // Typing a date takes ownership of it: it stops being the AI's guess.
      ...(next.expiresAt !== undefined ? { expiresAtEstimated: false } : null),
    })
  }

  return (
    <YStack
      backgroundColor={palette.creamPill}
      borderRadius={18}
      padding="$2"
      style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 }}
    >
      <XStack alignItems="center" gap="$1">
        <Pressable
          testID={`fridge-scan-item-${index}-include`}
          onPress={() => onChange({ ...item, included: !item.included })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.included }}
          accessibilityLabel={`${item.included ? 'Ne pas ajouter' : 'Ajouter'} ${item.name || 'ce produit'}`}
          style={[pointerCursor, { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }]}
        >
          <YStack
            width={26}
            height={26}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={item.included ? palette.freshText : 'transparent'}
            borderWidth={2}
            borderColor={item.included ? palette.freshText : palette.inkSecondary}
          >
            {item.included ? <CircleCheckIcon size={16} color="#FFFFFF" /> : null}
          </YStack>
        </Pressable>

        <Pressable
          testID={`fridge-scan-item-${index}-toggle`}
          onPress={() => {
            if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            onToggleExpanded()
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${item.name || 'Produit sans nom'} — ${summary}`}
          accessibilityHint={expanded ? 'Replier ce produit' : 'Modifier ce produit'}
          style={[pointerCursor, { flex: 1 }]}
        >
          <XStack alignItems="center" gap="$2" minHeight={44} opacity={item.included ? 1 : 0.5}>
            <YStack flex={1}>
              <Text fontSize={15} fontWeight="700" color={hasError ? palette.expiredText : palette.ink} numberOfLines={1}>
                {item.name || 'Produit sans nom'}
              </Text>
              <Text fontSize={12} fontWeight="500" color={item.duplicate ? palette.soonText : palette.inkSecondary} numberOfLines={1}>
                {item.duplicate ? `Déjà au frigo${summary ? ` · ${summary}` : ''}` : summary}
              </Text>
            </YStack>
            <YStack style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
              <ChevronRightIcon size={16} color={palette.inkSecondary} />
            </YStack>
          </XStack>
        </Pressable>
      </XStack>

      {expanded ? (
        <YStack gap="$3" padding="$2" paddingTop="$1">
          <ProductFields
            palette={palette}
            testIDPrefix={`fridge-scan-item-${index}`}
            values={values}
            onChange={patch}
            errors={{ name: errors?.name, amount: errors?.quantity, expiresAt: errors?.expiresAt }}
            expiryEstimated={item.expiresAtEstimated}
          />
          <Pressable
            testID={`fridge-scan-item-${index}-remove`}
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Retirer ${item.name || 'ce produit'} de la liste`}
            style={[pointerCursor, { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }]}
          >
            <XStack alignItems="center" gap="$1.5">
              <XIcon size={15} color={palette.expiredText} />
              <Text fontSize={13} fontWeight="700" color={palette.expiredText}>
                Retirer de la liste
              </Text>
            </XStack>
          </Pressable>
        </YStack>
      ) : null}
    </YStack>
  )
}
