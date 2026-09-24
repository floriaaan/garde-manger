import { useState, type ReactNode } from 'react'
import { TextInput, type KeyboardTypeOptions, type TextInputProps } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * Label above, palette-styled field below — was unstyled `TextInput`
 * (default text color, no background, `rgba(0,0,0,0.15)` border) so it
 * only ever worked on a light card; on `FormCard`'s dark-mode
 * `gradientBottom` (near-black) the default near-black input text and
 * near-invisible border made every field unreadable ("noir sur noir").
 * Mirrors `AuthField`'s recipe so it stays legible in both themes.
 *
 * Three things a usability critique caught, all of them shared by every
 * form in the app because they all render through here:
 * — `minHeight: 44`. `padding: 10` + `fontSize: 15` measured ~39pt, under
 *   the touch-target floor, on every field of every product form.
 * — `keyboardType`. Quantities and dates opened the full QWERTY keyboard;
 *   a caller that asks for `numeric` now gets it.
 * — a per-field `error`, announced as a live region. Errors used to appear
 *   as one string at the bottom of a long card, with nothing marking which
 *   field was wrong and nothing announced to a screen reader.
 *
 * The label takes an optional `icon`, drawn at 13px in `inkSecondary` beside
 * it. It sits on the label rather than inside the input because a glyph
 * inside the field competes with the caret and the placeholder for the same
 * line, and because a form of five fields is scanned by its labels.
 */
export function FormField({
  testID,
  label,
  value,
  onChangeText,
  palette,
  keyboardType,
  placeholder,
  autoCapitalize,
  hint,
  error,
  icon,
  surface = 'ground',
}: {
  testID: string
  label: string
  value: string
  onChangeText: (text: string) => void
  palette: SoftPalette
  keyboardType?: KeyboardTypeOptions
  placeholder?: string
  autoCapitalize?: TextInputProps['autoCapitalize']
  /** Quiet helper line under the field — the expected format, an example. */
  hint?: string
  error?: string | null
  /** Small glyph beside the label — `(color) => <TagIcon size={13} color={color} />`. */
  icon?: (color: string) => ReactNode
  /**
   * What the field sits on. `ground` (default) fills `cream`; `card` is a field
   * *on* a `cream` card, which a `cream` fill would erase — it takes the
   * `creamPill` fill and its hairline instead.
   */
  surface?: 'ground' | 'card'
}) {
  const [focused, setFocused] = useState(false)
  const idleBorder = surface === 'card' ? palette.creamPillEdge : 'transparent'
  const borderColor = error ? palette.expired : focused ? palette.accentLime : idleBorder

  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$1.5">
        {icon ? icon(palette.inkSecondary) : null}
        <Text fontSize={12} fontWeight="700" color={palette.ink}>
          {label}
        </Text>
      </XStack>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        keyboardType={keyboardType}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={palette.inkSecondary}
        style={{
          // minHeight, not height: large Dynamic Type needs room to grow.
          minHeight: 44,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: palette.ink,
          backgroundColor: surface === 'card' ? palette.creamPill : palette.cream,
          borderWidth: 2,
          borderColor,
        }}
      />
      {error ? (
        <Text
          testID={`${testID}-error`}
          fontSize={12}
          fontWeight="600"
          color={palette.expiredText}
          accessibilityLiveRegion="polite"
        >
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
