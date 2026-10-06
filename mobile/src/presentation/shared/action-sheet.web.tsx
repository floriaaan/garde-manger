import { useTranslation } from '../../i18n/index.js'
// Web fallback. Metro resolves action-sheet.native.tsx on iOS and Android.
import { KeyboardAvoidingView, Modal, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable } from './pressable.js'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor } from './hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ActionSheetRow } from './action-sheet-content.js'
import type { ActionSheetOption } from './action-sheet-content.js'

export type { ActionSheetOption } from './action-sheet-content.js'

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
  const { t } = useTranslation()
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
                accessibilityLabel={t('shared.cancel')}
                style={pointerCursor}
              >
                <XStack alignItems="center" justifyContent="center" minHeight={44} borderRadius={16}>
                  <Text fontSize={14} fontWeight="700" color={palette.inkSecondary}>{t('shared.cancel')}</Text>
                </XStack>
              </Pressable>
            </YStack>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </YStack>
    </Modal>
  )
}
