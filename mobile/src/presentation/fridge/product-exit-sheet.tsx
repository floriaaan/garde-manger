import { t, useTranslation } from '../../i18n/index.js'
/**
 * How a product leaves the garde-manger — the question the app never asked.
 *
 * Every exit used to be a deletion, so the foyer's fridge knew what it held and
 * nothing about what it lost. Three answers now, in the order they happen in a
 * kitchen: eaten, thrown away, or never there (a duplicate scan). Only the
 * first two count in the foyer's statistics, and the third is drawn quietly so
 * it stays a correction rather than becoming the habit (ADR-0012).
 *
 * "Jeté" opens a second step instead of three more rows, because a reason and
 * an amount are details of that one answer. Neither is required: a sheet that
 * blocks on "why" gets a random answer, which is worse than none.
 */
import { useState } from 'react'
import { Pressable } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { Chip } from '../shared/chip.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { productStatus } from '../dashboard/product-status.js'
import { BanIcon, CircleCheckIcon, PencilIcon } from '../dashboard/dashboard-icons.js'
import { DISCARD_REASONS } from '../../domain/fridge/product-outcome.js'
import type { DiscardReason } from '../../domain/fridge/product-outcome.js'
import type { Product } from '../../domain/fridge/product.js'

const REASON_LABELS: Record<DiscardReason, string> = {
  get expired() { return t('dashboard.past_expiry_2') },
  get spoiled() { return t('fridge.damaged') },
  get disliked() { return t('fridge.didn_t_like_it') },
  get other() { return t('fridge.other') },
}

export function ProductExitSheet({
  visible,
  products,
  onClose,
  onConsumed,
  onDiscarded,
  onCorrection,
}: {
  visible: boolean
  products: readonly Product[]
  onClose: () => void
  onConsumed: () => void
  onDiscarded: (details: { discardReason: DiscardReason | null; amount: number | null }) => void
  onCorrection: () => void
}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const single = products.length === 1 ? products[0] : null
  const allExpired = products.length > 0 && products.every((product) => productStatus(product) === 'expired')
  const stock = single && single.quantity.amount > 1 ? single.quantity.amount : null

  const [step, setStep] = useState<'choose' | 'discard'>('choose')
  const [reason, setReason] = useState<DiscardReason | null>(allExpired ? 'expired' : null)
  const [amount, setAmount] = useState<number | null>(stock)

  // Every opening starts over: yesterday's "Abîmé" must not pre-answer
  // today's milk. Reset during render rather than in an effect (React's own
  // "adjusting state when a prop changes" pattern) — an effect would commit
  // the stale step for one frame before catching up.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setStep('choose')
      setReason(allExpired ? 'expired' : null)
      setAmount(stock)
    }
  }

  const subject = single ? `« ${single.name} »` : `${products.length} produits`
  const plural = products.length > 1

  if (step === 'choose') {
    return (
      <ActionSheet
        visible={visible}
        onClose={onClose}
        title={t('fridge.remove_2', { value1: subject })}
        description={t('fridge.used_or_discarded_products_count_towards_the_household_s_stats')}
        options={[
          {
            testID: 'product-exit-consumed',
            label: plural ? t('fridge.used') : t('fridge.used_2'),
            icon: (color) => <CircleCheckIcon size={18} color={color} />,
            tint: palette.freshText,
            onPress: onConsumed,
          },
          {
            testID: 'product-exit-discarded',
            keepOpen: true,
            label: plural ? t('fridge.discarded') : t('fridge.discarded_2'),
            icon: (color) => <BanIcon size={18} color={color} />,
            tint: palette.soonText,
            onPress: () => setStep('discard'),
          },
          {
            testID: 'product-exit-correction',
            label: plural ? t('fridge.delete_entry_mistakes') : t('fridge.delete_entry_mistake'),
            icon: (color) => <PencilIcon size={18} color={color} />,
            tint: palette.inkSecondary,
            quiet: true,
            onPress: onCorrection,
          },
        ]}
      />
    )
  }

  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      title={t('fridge.discard_3', { value1: subject })}
      options={[
        {
          testID: 'product-exit-discard-confirm',
          label: t('fridge.discard_2'),
          icon: (color) => <BanIcon size={18} color={color} />,
          tint: palette.expired,
          destructive: true,
          onPress: () => onDiscarded({ discardReason: reason, amount }),
        },
      ]}
    >
      <YStack gap="$3" paddingHorizontal="$2" paddingBottom="$2">
        <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>{t('fridge.why_optional')}</Text>
        <XStack gap="$3" flexWrap="wrap">
          {DISCARD_REASONS.map((value) => (
            <Chip
              key={value}
              testID={`product-exit-reason-${value}`}
              label={REASON_LABELS[value]}
              selected={reason === value}
              // A second tap takes the answer back: optional has to be undoable.
              onPress={() => setReason((current) => (current === value ? null : value))}
              palette={palette}
            />
          ))}
        </XStack>

        {single && stock !== null && amount !== null ? (
          <XStack alignItems="center" justifyContent="space-between" gap="$3" marginTop="$1">
            <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>{t('fridge.discarded_quantity')}</Text>
            <XStack alignItems="center" gap="$2">
              <StepButton
                testID="product-exit-amount-decrease"
                label="−"
                // The count on the resulting label, not just "Un de moins":
                // `accessibilityLiveRegion` is Android-only in RN, so VoiceOver
                // on iOS never re-announces the `Text` between these buttons —
                // the label a screen reader focuses next has to carry the
                // number itself.
                accessibilityLabel={t('fridge.one_less_left', { count: amount - 1, value2: single.quantity.unit })}
                disabled={amount <= 1}
                onPress={() => setAmount(Math.max(1, amount - 1))}
              />
              <Text
                testID="product-exit-amount-value"
                fontSize={15}
                fontWeight="700"
                color={palette.ink}
                minWidth={72}
                textAlign="center"
                accessibilityLiveRegion="polite"
              >
                {amount} {single.quantity.unit}
              </Text>
              <StepButton
                testID="product-exit-amount-increase"
                label="+"
                accessibilityLabel={t('fridge.one_more_left', { count: amount + 1, value2: single.quantity.unit })}
                disabled={amount >= stock}
                onPress={() => setAmount(Math.min(stock, amount + 1))}
              />
            </XStack>
          </XStack>
        ) : null}
      </YStack>
    </ActionSheet>
  )
}

function StepButton({
  testID,
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  testID: string
  label: string
  accessibilityLabel: string
  disabled: boolean
  onPress: () => void
}) {
  const palette = useSoftPalette()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={pointerCursor}
    >
      <YStack
        width={36}
        height={36}
        borderRadius={12}
        alignItems="center"
        justifyContent="center"
        backgroundColor={palette.gradientBottom}
        opacity={disabled ? 0.4 : 1}
      >
        <Text fontSize={18} fontWeight="800" color={palette.ink}>
          {label}
        </Text>
      </YStack>
    </Pressable>
  )
}
