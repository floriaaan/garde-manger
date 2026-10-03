import { useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { Platform, TextInput, View, type TextInputProps } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { Pressable } from '../shared/pressable.js'
import { pointerCursor } from '../shared/hover.js'
import { useAuthGarden } from './auth-garden-theme.js'

/** Label above, rounded field below, lime focus ring — replaces the raw Tamagui `Input`. */
export function AuthField({
  label,
  labelColor,
  testID,
  trailingAction,
  ...inputProps
}: TextInputProps & {
  label: string
  ref?: Ref<TextInput>
  /** Tinted label ink for callers placing the field on a colored surface. */
  labelColor?: string
  testID?: string
  trailingAction?: { label: string; icon: ReactNode; onPress: () => void; testID?: string }
}) {
  const palette = useSoftPalette()
  const garden = useAuthGarden()
  const [focused, setFocused] = useState(false)
  return (
    <YStack gap="$1.5">
      <Text fontSize={12} fontWeight="600" color={labelColor ?? palette.inkSecondary}>
        {label}
      </Text>
      <View>
        <TextInput
          {...inputProps}
          testID={testID}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true)
            inputProps.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            inputProps.onBlur?.(e)
          }}
          placeholderTextColor={palette.inkSecondary}
          style={{
            minHeight: 48,
            borderRadius: garden ? 11 : 14,
            paddingLeft: 16,
            paddingRight: trailingAction ? 56 : 16,
            paddingVertical: 12,
            fontSize: 14,
            fontFamily: Platform.OS === 'web' ? '"Plus Jakarta Sans", system-ui, sans-serif' : undefined,
            color: palette.ink,
            backgroundColor: garden ? 'transparent' : palette.cream,
            borderWidth: 2,
            borderColor: focused ? garden?.ink ?? palette.accentLime : garden?.muted ?? 'transparent',
          }}
        />
        {trailingAction ? (
          <Pressable
            testID={trailingAction.testID}
            onPress={trailingAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={trailingAction.label}
            style={[pointerCursor, { position: 'absolute', right: 4, top: 2, bottom: 2, width: 44, alignItems: 'center', justifyContent: 'center' }]}
          >
            {trailingAction.icon}
          </Pressable>
        ) : null}
      </View>
    </YStack>
  )
}
