import { useTranslation } from '../../i18n/index.js'
import { useEffect, useLayoutEffect, useState } from 'react'
import { Pressable } from './pressable.js'
import { Text, YStack } from './tamagui-typed.js'
import { ActionSheetRow } from './action-sheet-content.js'
import type { ActionSheetOption } from './action-sheet-content.js'
import { nativeSheetStore } from './native-sheet-store.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export type { ActionSheetOption } from './action-sheet-content.js'

export function ActionSheet({ visible, onClose, options, title, description, closeLabel, children }: {
  visible: boolean
  onClose: () => void
  options: ActionSheetOption[]
  title?: string
  description?: string
  closeLabel?: string
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const palette = useSoftPalette()
  const [owner] = useState(() => Symbol('sheet'))
  const close = () => nativeSheetStore.close(owner)
  useLayoutEffect(() => {
    if (!visible) {
      nativeSheetStore.close(owner)
      return
    }
    nativeSheetStore.show({ owner, onClose, content: (
      <YStack gap="$2.5" padding="$4">
        {title ? <YStack gap="$1" paddingBottom="$2">
          <Text accessibilityRole="header" fontSize={15} fontWeight="800" color={palette.ink}>{title}</Text>
          {description ? <Text fontSize={13} color={palette.inkSecondary}>{description}</Text> : null}
        </YStack> : null}
        {children}
        {options.map((option) => <ActionSheetRow key={option.testID} palette={palette} option={{
          ...option,
          onPress: () => {
            if (!option.keepOpen) close()
            option.onPress()
          },
        }} />)}
        <Pressable testID="action-sheet-cancel" accessibilityRole="button" accessibilityLabel={closeLabel ?? t('shared.cancel')} onPress={close}>
          <YStack minHeight={44} alignItems="center" justifyContent="center">
            <Text fontSize={14} fontWeight="700" color={palette.inkSecondary}>{closeLabel ?? t('shared.cancel')}</Text>
          </YStack>
        </Pressable>
      </YStack>
    ) })
  })
  useEffect(() => () => nativeSheetStore.close(owner), [owner])
  return null
}
