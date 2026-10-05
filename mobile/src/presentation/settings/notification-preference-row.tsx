import { Switch } from 'react-native'
import { Text, XStack } from '../shared/tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function NotificationPreferenceRow({ label, enabled, pending, onChange, palette, testID }: {
  label: string
  enabled: boolean
  pending: boolean
  onChange: (enabled: boolean) => void
  palette: SoftPalette
  testID: string
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3" minHeight={56}>
      <Text flex={1} fontSize={15} fontWeight="700" color={palette.ink} lineHeight={22}>{label}</Text>
      <XStack minHeight={48} flexShrink={0} alignItems="center">
        <Switch testID={testID} accessibilityLabel={label} value={enabled} hitSlop={8}
          style={{ alignSelf: 'center', margin: 0 }}
          disabled={pending} onValueChange={onChange} trackColor={{ true: palette.freshText }} />
      </XStack>
    </XStack>
  )
}
