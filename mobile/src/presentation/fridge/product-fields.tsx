import { t, useTranslation } from '../../i18n/index.js'
/**
 * The product form's fields, without the screen around them: name, quantity
 * and unit (with unit chips), expiry (with date shortcuts) and compartment.
 *
 * Extracted from `fridge-form-screen.tsx` so the barcode/manual form and the
 * fridge-scan review edit a product with the very same controls — chips over
 * typing — instead of the review carrying its own, heavier set of inputs.
 * Controlled and validation-free: the owner keeps the state and the errors.
 */
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { Chip, CHIP_ICON_SIZE } from '../shared/chip.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ArchiveIcon, PencilIcon, RefrigeratorIcon, ScaleIcon, SnowflakeIcon } from '../dashboard/dashboard-icons.js'
import { daysUntilExpiry, expiryLabel } from '../dashboard/product-status.js'
import { FormField } from './form-field.js'
import { DateField, toIsoDay } from './date-field.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'

export const LOCATION_LABELS: Record<LocationValue, string> = { get fridge() { return t('fridge.fridge') }, get freezer() { return t('fridge.freezer') }, get pantry() { return t('fridge.cupboard') } }

/** Same glyph per compartment as the fridge screen's filters and shelf headers. */
const LOCATION_ICONS: Record<LocationValue, (color: string) => React.ReactNode> = {
  fridge: (color) => <RefrigeratorIcon size={CHIP_ICON_SIZE} color={color} />,
  freezer: (color) => <SnowflakeIcon size={CHIP_ICON_SIZE} color={color} />,
  pantry: (color) => <ArchiveIcon size={CHIP_ICON_SIZE} color={color} />,
}

/** The units a fridge actually holds. Free text stays available beside them. */
const UNIT_SUGGESTIONS = () => ['g', 'kg', 'mL', 'L', t('fridge.item_s')]

const DATE_SHORTCUTS: { label: string; days: number | null }[] = [
  { get label() { return t('fridge.3_days') }, days: 3 },
  { get label() { return t('fridge.1_week') }, days: 7 },
  { get label() { return t('fridge.1_month') }, days: 30 },
  { get label() { return t('dashboard.no_date') }, days: null },
]

export function isoDay(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return toIsoDay(date)
}

export interface ProductFieldValues {
  name: string
  /** Text, parsed by the owner at submit time. */
  amount: string
  unit: string
  /** `YYYY-MM-DD`, or empty for no date. */
  expiresAt: string
  location: LocationValue
}

export type ProductFieldErrors = Partial<Record<'name' | 'amount' | 'expiresAt', string>>

export function ProductFields({
  palette,
  values,
  onChange,
  errors,
  testIDPrefix,
  expiryEstimated = false,
}: {
  palette: SoftPalette
  values: ProductFieldValues
  onChange: (patch: Partial<ProductFieldValues>) => void
  errors?: ProductFieldErrors
  /** `fridge-form` keeps the manual form's test ids; the review passes its own per-row prefix. */
  testIDPrefix: string
  /** The date came from the AI's guess: say so until the member edits it. */
  expiryEstimated?: boolean
}) {
  const { t } = useTranslation()
  const expiryDays = values.expiresAt.trim().length > 0 ? daysUntilExpiry({ expiresAt: values.expiresAt.trim() }) : null
  const expiryHint = expiryDays !== null ? t('fridge.summary', { value1: expiryLabel(expiryDays), value2: expiryEstimated ? t('common.estimated_suffix') : '' }) : undefined

  return (
    <YStack gap="$3">
      <FormField
        testID={`${testIDPrefix}-name`}
        label={t('fridge.name')}
        value={values.name}
        onChangeText={(name) => onChange({ name })}
        palette={palette}
        error={errors?.name}
        icon={(color) => <PencilIcon size={13} color={color} />}
      />

      <XStack gap="$2">
        <YStack flex={1}>
          <FormField
            testID={`${testIDPrefix}-amount`}
            label={t('fridge.quantity')}
            value={values.amount}
            onChangeText={(amount) => onChange({ amount })}
            palette={palette}
            keyboardType="number-pad"
            hint={t('fridge.whole_number')}
            error={errors?.amount}
            icon={(color) => <ScaleIcon size={13} color={color} />}
          />
        </YStack>
        <YStack flex={1}>
          <FormField
            testID={`${testIDPrefix}-unit`}
            label={t('fridge.unit')}
            value={values.unit}
            onChangeText={(unit) => onChange({ unit })}
            palette={palette}
            autoCapitalize="none"
          />
        </YStack>
      </XStack>
      <XStack gap="$2.5" flexWrap="wrap">
        {UNIT_SUGGESTIONS().map((suggestion) => (
          <Chip
            key={suggestion}
            testID={`${testIDPrefix}-unit-${suggestion}`}
            label={suggestion}
            selected={values.unit === suggestion}
            onPress={() => onChange({ unit: suggestion })}
            palette={palette}
            size="dense"
          />
        ))}
      </XStack>

      <YStack gap="$2">
        <DateField
          testID={`${testIDPrefix}-expires-at`}
          label={t('fridge.expiry_date')}
          value={values.expiresAt}
          onChange={(expiresAt) => onChange({ expiresAt })}
          palette={palette}
          hint={expiryHint}
          error={errors?.expiresAt}
        />
        <XStack gap="$2.5" flexWrap="wrap">
          {DATE_SHORTCUTS.map((shortcut) => (
            <Chip
              key={shortcut.label}
              testID={`${testIDPrefix}-expires-in-${shortcut.days ?? 'none'}`}
              label={shortcut.days === null ? shortcut.label : `+ ${shortcut.label}`}
              selected={shortcut.days === null ? values.expiresAt === '' : values.expiresAt === isoDay(shortcut.days)}
              onPress={() => onChange({ expiresAt: shortcut.days === null ? '' : isoDay(shortcut.days) })}
              palette={palette}
              size="dense"
            />
          ))}
        </XStack>
      </YStack>

      <YStack gap="$1">
        <XStack alignItems="center" gap="$1.5">
          <ArchiveIcon size={13} color={palette.inkSecondary} />
          <Text fontSize={12} fontWeight="700" color={palette.ink}>{t('fridge.location')}</Text>
        </XStack>
        <XStack gap="$3" flexWrap="wrap">
          {LOCATIONS.map((loc) => (
            <Chip
              key={loc}
              testID={`${testIDPrefix}-location-${loc}`}
              label={LOCATION_LABELS[loc]}
              selected={values.location === loc}
              onPress={() => onChange({ location: loc })}
              palette={palette}
              icon={LOCATION_ICONS[loc]}
            />
          ))}
        </XStack>
      </YStack>
    </YStack>
  )
}
