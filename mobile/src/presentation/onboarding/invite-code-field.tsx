/*
 * Eight cells, not a text field.
 *
 * The invite code is exactly eight characters of [A-Z0-9] and nothing else
 * (`invite-code.ts`, mirroring the backend's value object). A single-line
 * input would have to *say* that in a hint under itself and then police it in
 * an error message afterwards; a row of eight cells says it before anyone
 * types, and the submit button that lights up on the eighth cell needs no
 * explanation at all.
 *
 * The cascade is the surface's one authored motion. A code almost never
 * arrives one character at a time — it is pasted out of a message, scanned off
 * a QR, or carried in by a `gardemanger://join` link — and eight characters
 * appearing simultaneously reads as a field that was pre-filled by the system,
 * which is exactly the moment a user stops checking whether it is the right
 * code. Landing them left to right, one cell every 45ms, is the code arriving
 * *somewhere you can watch it*, and it takes 315ms total: under the threshold
 * where a wait becomes a delay. Typed characters never cascade — a stagger
 * behind a finger is lag, not motion.
 *
 * One hidden input drives all eight, rather than eight inputs with focus
 * juggling between them: a screen reader meets one field with one label and
 * one value, and the platform's own paste and autofill land on it intact.
 */
import { useEffect, useRef, useState } from 'react'
import { Animated, Platform, Pressable, TextInput, type TextStyle } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useReduceMotion } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '../../domain/identity/invite-code.js'

/** One cell every 45ms: eight cells land in 315ms, read as one movement crossing the row. */
const CASCADE_STEP_MS = 45

/**
 * Invisible, and exactly on top of the cells it drives, so a tap anywhere on
 * the row reaches it and the OS paste bubble appears over the right place.
 * `opacity: 0`, never `display: none` or a zero-sized box: a field with no box
 * cannot be focused by a keyboard, and the caret has to have somewhere to be.
 *
 * `outlineStyle` is a web-only CSS property react-native-web understands and
 * RN's `TextStyle` does not declare, hence the cast. The visible focus
 * treatment is the active cell's own lime hairline; a browser outline drawn
 * around an invisible box would be a second, invisible focus ring.
 */
const HIDDEN_INPUT_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  opacity: 0,
  ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
} as TextStyle

/**
 * How many cells are currently allowed to show ink.
 *
 * Follows `value.length` immediately when the code grows one character at a
 * time (typing), and walks up to it when several characters land at once
 * (paste, scan, deep link). Deletions are never staggered — a backspace has to
 * feel like a backspace.
 */
function useCascade(value: string, reduceMotion: boolean): number {
  const [revealed, setRevealed] = useState(value.length)
  const previous = useRef(value.length)

  useEffect(() => {
    const target = value.length
    const from = previous.current
    previous.current = target

    if (reduceMotion || target <= from + 1) {
      setRevealed(target)
      return
    }

    setRevealed(from)
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let step = 1; step <= target - from; step += 1) {
      timers.push(setTimeout(() => setRevealed(from + step), step * CASCADE_STEP_MS))
    }
    return () => timers.forEach(clearTimeout)
  }, [value, reduceMotion])

  return revealed
}

export function InviteCodeField({
  value,
  onChangeText,
  onSubmit,
  autoFocus,
  invalid,
  testID = 'invite-code-field',
}: {
  value: string
  onChangeText: (next: string) => void
  onSubmit?: () => void
  autoFocus?: boolean
  /** Turns every cell's hairline coral — the field is the error's anchor, not a sentence below it. */
  invalid?: boolean
  testID?: string
}) {
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const inputRef = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  const revealed = useCascade(value, reduceMotion)

  // `?? ''`: `revealed` tracks `value.length` through `useCascade`'s own
  // timers, but a timer fires outside React's render cycle — a value shorter
  // than what a still-in-flight cascade was staged for reads past the end of
  // `value` for one tick before the effect's cleanup catches up, and
  // `undefined` reached `CodeCell`'s `char.length` (prod crash, traced from
  // this exact line).
  const cells = Array.from({ length: INVITE_CODE_LENGTH }, (_, index) =>
    index < revealed ? (value[index] ?? '') : '',
  )
  // The cell the next character lands in — highlighted only while the field
  // holds focus, so a filled-in row at rest carries no false caret.
  const activeIndex = Math.min(value.length, INVITE_CODE_LENGTH - 1)

  return (
    <YStack gap="$2" position="relative">
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessible={false}
        // The row is a hit target for the input beneath it, not a control of
        // its own: the real focusable element is the TextInput.
        importantForAccessibility="no-hide-descendants"
      >
        <XStack gap="$2" alignItems="center">
          {cells.map((char, index) => (
            <CodeCell
              key={index}
              char={char}
              active={focused && index === activeIndex && value.length < INVITE_CODE_LENGTH}
              invalid={invalid}
              reduceMotion={reduceMotion}
              palette={palette}
            />
          ))}
        </XStack>
      </Pressable>

      <TextInput
        ref={inputRef}
        testID={testID}
        value={value}
        onChangeText={(next) => onChangeText(normalizeInviteCode(next))}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        // The code is digits and capitals; `visible-password` is the one
        // Android keyboard that shows both without the suggestion strip
        // rewriting what was typed. iOS/web ignore it and keep the default.
        keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
        maxLength={INVITE_CODE_LENGTH}
        accessibilityLabel="Code d’invitation"
        accessibilityHint="Huit lettres ou chiffres, donnés par un membre du foyer"
        style={HIDDEN_INPUT_STYLE}
      />
    </YStack>
  )
}

function CodeCell({
  char,
  active,
  invalid,
  reduceMotion,
  palette,
}: {
  char: string
  active: boolean
  invalid?: boolean
  reduceMotion: boolean
  palette: SoftPalette
}) {
  const filled = char.length > 0
  const [land] = useState(() => new Animated.Value(filled ? 1 : 0))

  useEffect(() => {
    if (reduceMotion) {
      land.setValue(filled ? 1 : 0)
      return
    }
    if (!filled) {
      land.setValue(0)
      return
    }
    // Exponential ease-out from an already-visible cell: the character drops
    // the last few points into place and settles. The cell itself never
    // animates in — an empty row is the field's resting state, not a reveal.
    land.setValue(0)
    Animated.spring(land, { toValue: 1, friction: 6, tension: 220, useNativeDriver: true }).start()
  }, [filled, char, land, reduceMotion])

  const border = invalid ? palette.expired : active ? palette.accentLime : palette.creamPillEdge

  return (
    <YStack
      flex={1}
      // minHeight, not height: a large system font size grows the cell rather
      // than clipping the character in it.
      minHeight={52}
      alignItems="center"
      justifyContent="center"
      backgroundColor={palette.cream}
      style={{
        borderRadius: 12,
        borderWidth: active || invalid ? 2 : 1,
        borderColor: border,
      }}
    >
      <Animated.View
        style={{
          opacity: land,
          transform: [{ translateY: land.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        }}
      >
        <Text fontSize={20} fontWeight="800" color={palette.ink}>
          {char}
        </Text>
      </Animated.View>
    </YStack>
  )
}
