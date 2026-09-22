import { createElement, useState } from 'react'
import { Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Pressable } from '../shared/pressable.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { ripple, rippleClip } from '../shared/material.js'
import { CalendarIcon, XIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/** Local calendar date, `YYYY-MM-DD` — the format the fields and the backend both read. */
export function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** "12 octobre 2026" — the field shows a date, the value stays `YYYY-MM-DD`. */
function readableDay(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * `FormField`'s twin for a date: same label / hint / error frame, but the box
 * itself opens the platform's date picker instead of a keyboard.
 *
 * The expiry date used to be a plain `TextInput` asking for "AAAA-MM-JJ" —
 * a format to get right by hand, on a keyboard that doesn't even offer a
 * dash on Android, validated only at submit. A date has a native control on
 * every platform this app runs on (a dialog on Android, the inline calendar
 * on iOS, `<input type="date">` on web); this is that control, wearing the
 * form's clothes, so an invalid date is no longer expressible.
 *
 * `onChange('')` clears it: "no date" is a normal answer here (a tin of
 * beans), hence the clear control rather than a mandatory value.
 */
export function DateField({
  testID,
  label,
  value,
  onChange,
  palette,
  hint,
  error,
}: {
  testID: string
  label: string
  /** `YYYY-MM-DD`, or empty for no date. */
  value: string
  onChange: (value: string) => void
  palette: SoftPalette
  hint?: string
  error?: string | null
}) {
  // Android's picker is a one-shot dialog (fires once, then dismisses itself);
  // iOS's is an inline calendar that stays mounted while `open` is true.
  const [open, setOpen] = useState(false)
  const day = value.trim()
  const borderColor = error ? palette.expired : open ? palette.accentLime : 'transparent'

  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$1.5">
        <CalendarIcon size={13} color={palette.inkSecondary} />
        <Text fontSize={12} fontWeight="700" color={palette.ink}>
          {label}
        </Text>
      </XStack>

      {Platform.OS === 'web' ? (
        // RN Web renders DOM elements as-is, so the browser's own date control
        // is one line — no picker library, no calendar to re-implement.
        createElement('input', {
          type: 'date',
          'data-testid': testID,
          value: day,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: {
            minHeight: 44,
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 15,
            color: palette.ink,
            backgroundColor: palette.cream,
            border: `2px solid ${borderColor === 'transparent' ? palette.cream : borderColor}`,
          },
        })
      ) : (
        <XStack alignItems="center" gap="$2">
          <Pressable
            testID={testID}
            onPress={() => setOpen((shown) => !shown)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityValue={{ text: day ? readableDay(day) : 'Aucune date' }}
            android_ripple={ripple(palette.chipTeal)}
            style={[{ flex: 1 }, pointerCursor, rippleClip(12)]}
          >
            <XStack
              alignItems="center"
              minHeight={44}
              borderRadius={12}
              paddingHorizontal={12}
              paddingVertical={10}
              backgroundColor={palette.cream}
              borderWidth={2}
              borderColor={borderColor}
            >
              <Text fontSize={15} color={day ? palette.ink : palette.inkSecondary}>
                {day ? readableDay(day) : 'Aucune date'}
              </Text>
            </XStack>
          </Pressable>
          {day ? (
            <Pressable
              testID={`${testID}-clear`}
              onPress={() => onChange('')}
              accessibilityRole="button"
              accessibilityLabel="Retirer la date"
              hitSlop={8}
              android_ripple={ripple(palette.chipTeal, { borderless: true })}
              style={pointerCursor}
            >
              <XIcon size={16} color={palette.inkSecondary} />
            </Pressable>
          ) : null}
        </XStack>
      )}

      {open ? (
        <DateTimePicker
          testID={`${testID}-picker`}
          value={day ? new Date(`${day}T00:00:00`) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            // Android's dialog dismisses itself either way; iOS's inline
            // calendar stays until it's tapped shut again.
            if (Platform.OS === 'android') setOpen(false)
            if (event.type === 'set' && date) onChange(toIsoDay(date))
          }}
        />
      ) : null}

      {error ? (
        <Text testID={`${testID}-error`} fontSize={12} fontWeight="600" color={palette.expiredText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text fontSize={11} fontWeight="500" color={palette.inkSecondary}>
          {hint}
        </Text>
      ) : null}
    </YStack>
  )
}
