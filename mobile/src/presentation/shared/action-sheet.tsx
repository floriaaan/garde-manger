import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ChevronRightIcon } from '../dashboard/dashboard-icons.js'
import { ripple } from './material.js'

export interface ActionSheetOption {
  testID: string
  label: string
  /** Rendered inside a `tint`-colored 36×36 chip — same shape as settings' row icons. */
  icon: (color: string) => React.ReactNode
  tint: string
  onPress: () => void
  /** Irreversible: the row carries the status-expired colors and names the consequence. */
  destructive?: boolean
  /**
   * A correction, not a real option — same size and weight as every other
   * row (DESIGN.md: hierarchy is never colour alone), but the label takes
   * `inkSecondary` rather than `ink`, the same treatment "Annuler" already
   * carries below. A distinct icon-chip tint on its own left the label
   * reading exactly as loud as "Consommé"/"Jeté".
   */
  quiet?: boolean
}

/** One option — styled as its own card-button, matching settings' "Historique des tickets" row. */
function ActionSheetRow({ option, palette }: { option: ActionSheetOption; palette: SoftPalette }) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={option.testID}
      onPress={option.onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      android_ripple={ripple(option.destructive ? palette.expiredText : palette.ink)}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="center"
          gap="$3"
          backgroundColor={option.destructive ? palette.expiredBg : palette.gradientBottom}
          borderRadius={16}
          padding="$3"
          minHeight={44}
          style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 }}
        >
          <YStack width={36} height={36} borderRadius={12} backgroundColor={option.tint} alignItems="center" justifyContent="center">
            {option.icon(palette.onDark)}
          </YStack>
          <Text
            fontSize={14}
            fontWeight="700"
            color={option.destructive ? palette.expiredText : option.quiet ? palette.inkSecondary : palette.ink}
            flex={1}
          >
            {option.label}
          </Text>
          <ChevronRightIcon size={18} color={palette.inkSecondary} />
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

/**
 * A minimal two-to-a-few-option bottom sheet — no new library (the app has
 * no other action-sheet usage to justify one, and this keeps behavior
 * identical across web/iOS/Android instead of reaching for the
 * iOS-only `ActionSheetIOS`). Renders nothing at all when `visible` is
 * false, rather than relying on RN `Modal`'s own `visible` prop, so tests
 * don't depend on how the test renderer mocks `Modal`.
 *
 * Options are separated by spacing/shadow (each its own card-button), not a
 * drawn divider line — DESIGN.md bans visible strokes on containers, and a
 * gap between distinct cards reads as separation without one.
 */
export function ActionSheet({
  visible,
  onClose,
  options,
  title,
  description,
  children,
}: {
  visible: boolean
  onClose: () => void
  options: ActionSheetOption[]
  /** Names what the sheet is deciding — required reading before a destructive row. */
  title?: string
  description?: string
  /** Rendered between the title and the options — for a choice the options alone can't carry. */
  children?: React.ReactNode
}) {
  const palette = useSoftPalette()
  if (!visible) return null

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <YStack flex={1} justifyContent="flex-end">
        {/* The scrim is a sibling behind the sheet, not its parent. It used to
            wrap it, which meant a screen reader met a full-screen unlabeled
            button as the first thing in the app's only modal — and hiding that
            button from the accessibility tree hid every option inside it too.
            As a sibling it can be hidden safely; the accessible way out is the
            "Annuler" row, which says what it does. */}
        <Pressable
          testID="action-sheet-backdrop"
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.scrim }}
        />
        {/* `edges={['bottom']}`: keeps the floating gap below clear of the home indicator,
            same intent as AppShell's own SafeAreaView — a plain `useSafeAreaInsets()` read
            requires a `SafeAreaProvider` ancestor the app never mounts one of. The padding
            here (not on the card itself) is what lifts the sheet off every screen edge;
            the card's own radius is uniform on all four corners — floating, not
            edge-to-edge, so a top-only radius would look clipped at the bottom. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <YStack backgroundColor={palette.layoutSurface} borderRadius={32} style={{ paddingHorizontal: 20, paddingVertical: 20 }} gap="$2.5">
              {title ? (
                <YStack gap="$1" paddingHorizontal="$2" paddingBottom="$1">
                  <Text fontSize={15} fontWeight="800" color={palette.ink}>
                    {title}
                  </Text>
                  {description ? (
                    <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
                      {description}
                    </Text>
                  ) : null}
                </YStack>
              ) : null}
              {children}
              {options.map((option) => (
                <ActionSheetRow key={option.testID} option={option} palette={palette} />
              ))}
              {/* The backdrop and Android back were the only ways out. A visible
                  way to say "no" belongs on any sheet, and is required on one
                  that carries a destructive row. */}
              <Pressable
                testID="action-sheet-cancel"
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Annuler"
                style={pointerCursor}
              >
                <XStack alignItems="center" justifyContent="center" minHeight={44} borderRadius={16}>
                  <Text fontSize={14} fontWeight="700" color={palette.inkSecondary}>
                    Annuler
                  </Text>
                </XStack>
              </Pressable>
            </YStack>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </YStack>
    </Modal>
  )
}
