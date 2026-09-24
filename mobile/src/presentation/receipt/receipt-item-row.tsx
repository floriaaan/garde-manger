import { Animated } from 'react-native'
import { Pressable } from '../shared/pressable.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ChevronRightIcon, PencilIcon, ScaleIcon, TagIcon, WalletIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { FormField } from '../fridge/form-field.js'
import { DateField } from '../fridge/date-field.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import { daysUntilExpiry, expiryLabel } from '../dashboard/product-status.js'

/**
 * String fields for every text input (same convention `fridge-form-screen.tsx`
 * uses for `amount`/`expiresAt`) — parsed/validated once, at submit time, in
 * `receipt-review-screen.tsx`, not on every keystroke here.
 */
export interface EditableReceiptItem {
  name: string
  quantity: string
  unit: string
  category: string
  price: string
  location: LocationValue
  expiresAt: string
  /**
   * True when `expiresAt` was filled in from the AI's `expiresInDays` guess
   * rather than typed. Drives the "estimée" hint below, and clears the
   * moment the household edits the field — at that point it's their date,
   * not a guess to keep flagging.
   */
  expiresAtEstimated: boolean
}

export type ReceiptItemErrors = Partial<Record<'name' | 'quantity' | 'price' | 'expiresAt', string>>

const LOCATION_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

/**
 * Collapsed by default: one summary line per item, tap to open.
 *
 * Every item used to render six text inputs and a location picker, all
 * expanded, always — a 20-line receipt was 120 visible text fields, so the
 * feature built to replace typing produced strictly more of it. The AI's
 * extraction is meant to be *approved*, not retyped; the fields are still
 * one tap away for the lines it got wrong.
 */
export function ReceiptItemRow({
  index,
  item,
  expanded,
  onToggle,
  onChange,
  onRemove,
  errors,
  showPrice = true,
}: {
  index: number
  item: EditableReceiptItem
  expanded: boolean
  onToggle: () => void
  onChange: (item: EditableReceiptItem) => void
  onRemove: () => void
  errors?: ReceiptItemErrors
  /** The fridge-scan flow has no price to show or edit — see `fridge-scan-review-screen.tsx`. */
  showPrice?: boolean
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  const hasError = Boolean(errors && Object.keys(errors).length > 0)

  function set<K extends keyof EditableReceiptItem>(key: K, value: EditableReceiptItem[K]) {
    // Editing the date by hand is the household taking ownership of it —
    // the "estimée" hint below only makes sense while the value is still
    // the AI's guess, untouched.
    onChange({ ...item, [key]: value, ...(key === 'expiresAt' ? { expiresAtEstimated: false } : null) })
  }

  const summary = [
    item.quantity.trim().length > 0 ? `${item.quantity} ${item.unit}`.trim() : null,
    LOCATION_LABELS[item.location],
    showPrice && item.price.trim().length > 0 ? `${item.price} €` : null,
    // Same vocabulary the fridge list and dashboard use for a date
    // (`expiryLabel`/`daysUntilExpiry`) — one source of truth for "what does
    // this date mean", not a second phrasing invented for this screen.
    item.expiresAt.trim().length > 0 ? expiryLabel(daysUntilExpiry({ expiresAt: item.expiresAt })) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <YStack
      backgroundColor={palette.gradientBottom}
      borderRadius={16}
      padding="$2"
      gap="$2"
      marginBottom="$2"
      style={{
        // Card-float shadow (DESIGN.md's shadow vocabulary) — this row
        // shares its background color with the card it sits inside, so
        // without a shadow it has no visible boundary at all.
        shadowColor: hasError ? palette.expired : palette.shadowCool,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: hasError ? 0.35 : 0.1,
        shadowRadius: 18,
        elevation: 2,
      }}
    >
      <XStack alignItems="center" gap="$2">
        <Pressable
          testID={`receipt-item-${index}-toggle`}
          onPress={onToggle}
          onHoverIn={hover.onHoverIn}
          onHoverOut={hover.onHoverOut}
          onPressIn={hover.onPressIn}
          onPressOut={hover.onPressOut}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${item.name || 'Article sans nom'} — ${summary}`}
          accessibilityHint={expanded ? 'Replier cet article' : 'Modifier cet article'}
          style={[pointerCursor, { flex: 1 }]}
        >
          <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
            <XStack alignItems="center" gap="$3" minHeight={44} paddingHorizontal="$2">
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="700" color={hasError ? palette.expiredText : palette.ink} numberOfLines={1}>
                  {item.name || 'Article sans nom'}
                </Text>
                <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} numberOfLines={1}>
                  {summary}
                </Text>
              </YStack>
              <Animated.View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                <ChevronRightIcon size={16} color={palette.inkSecondary} />
              </Animated.View>
            </XStack>
          </Animated.View>
        </Pressable>

        {/* There was no way to drop a line the AI misread — a "SAC PLASTIQUE
            0,03" had to be imported into the fridge as a product. */}
        <Pressable
          testID={`receipt-item-${index}-remove`}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${item.name || 'cet article'} du ticket`}
          style={pointerCursor}
        >
          <YStack width={44} height={44} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor={palette.expiredBg}>
            <XIcon size={15} color={palette.expiredText} />
          </YStack>
        </Pressable>
      </XStack>

      {expanded ? (
        <YStack gap="$2" paddingHorizontal="$2" paddingBottom="$2">
          <FormField
            testID={`receipt-item-${index}-name`}
            label="Nom"
            value={item.name}
            onChangeText={(v) => set('name', v)}
            palette={palette}
            error={errors?.name}
            icon={(color) => <PencilIcon size={13} color={color} />}
          />
          <XStack gap="$2">
            <YStack flex={1}>
              <FormField
                testID={`receipt-item-${index}-quantity`}
                label="Quantité"
                value={item.quantity}
                onChangeText={(v) => set('quantity', v)}
                palette={palette}
                keyboardType="decimal-pad"
                error={errors?.quantity}
                icon={(color) => <ScaleIcon size={13} color={color} />}
              />
            </YStack>
            <YStack flex={1}>
              <FormField
                testID={`receipt-item-${index}-unit`}
                label="Unité"
                value={item.unit}
                onChangeText={(v) => set('unit', v)}
                palette={palette}
                autoCapitalize="none"
              />
            </YStack>
          </XStack>
          <XStack gap="$2">
            <YStack flex={1}>
              <FormField
                testID={`receipt-item-${index}-category`}
                label="Catégorie"
                value={item.category}
                onChangeText={(v) => set('category', v)}
                palette={palette}
                icon={(color) => <TagIcon size={13} color={color} />}
              />
            </YStack>
            {showPrice ? (
              <YStack flex={1}>
                <FormField
                  testID={`receipt-item-${index}-price`}
                  label="Prix (€)"
                  value={item.price}
                  onChangeText={(v) => set('price', v)}
                  palette={palette}
                  keyboardType="decimal-pad"
                  error={errors?.price}
                  icon={(color) => <WalletIcon size={13} color={color} />}
                />
              </YStack>
            ) : null}
          </XStack>
          <DateField
            testID={`receipt-item-${index}-expires-at`}
            label="Date de péremption"
            value={item.expiresAt}
            onChange={(v) => set('expiresAt', v)}
            palette={palette}
            hint={
              item.expiresAtEstimated
                ? 'Estimée par l’IA à partir du produit — vérifie si besoin.'
                : 'Laisse vide si le produit se garde longtemps.'
            }
            error={errors?.expiresAt}
          />

          <YStack gap="$1">
            <Text fontSize={12} fontWeight="700" color={palette.ink}>
              Emplacement
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {LOCATIONS.map((loc) => (
                <Pressable
                  key={loc}
                  testID={`receipt-item-${index}-location-${loc}`}
                  onPress={() => set('location', loc)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.location === loc }}
                  style={pointerCursor}
                >
                  <XStack
                    alignItems="center"
                    minHeight={44}
                    paddingHorizontal="$3"
                    borderRadius={999}
                    backgroundColor={item.location === loc ? palette.accentLime : palette.mintPale}
                  >
                    <Text fontSize={12} fontWeight="700" color={item.location === loc ? palette.accentLimeText : palette.mintPaleText}>
                      {LOCATION_LABELS[loc]}
                    </Text>
                  </XStack>
                </Pressable>
              ))}
            </XStack>
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
