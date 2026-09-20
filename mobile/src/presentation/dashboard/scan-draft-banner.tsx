import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { pointerCursor } from '../shared/hover.js'
import { useReviewableDraftsQuery } from '../../application/job/scan-drafts.query.js'
import { taskAge } from '../job/job-labels.js'
import { PencilIcon, ReceiptIcon, ScanLineIcon } from './dashboard-icons.js'
import type { SoftPalette } from './soft-palette.js'

/** An AI scan finished and nobody reviewed it yet — the case a toast cannot carry once it is gone. */
export function ScanDraftBanner({ palette }: { palette: SoftPalette }) {
  const drafts = useReviewableDraftsQuery()
  const latest = drafts[0]
  if (!latest) return null

  const receipt = latest.kind === 'receipt'
  const Icon = receipt ? ReceiptIcon : ScanLineIcon
  const what = receipt ? 'ticket' : 'frigo'
  const pathname = receipt ? '/receipts/review' : '/fridge-scan/review'
  const open = () => router.push({ pathname, params: { draftId: latest.id } })

  return (
    <XStack
      testID="dashboard-scan-draft"
      backgroundColor={palette.creamPill}
      borderRadius={22}
      padding="$3.5"
      alignItems="center"
      gap="$3"
      style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2 }}
    >
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Brouillon à relire : ${what}`}
        style={[pointerCursor, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
      >
        <YStack width={40} height={40} borderRadius={14} backgroundColor={palette.soonBg} alignItems="center" justifyContent="center">
          <Icon size={19} color={palette.soonText} />
        </YStack>
        <YStack flex={1}>
          <Text fontSize={15} fontWeight="800" color={palette.ink} numberOfLines={1}>
            {receipt ? 'Ticket à relire' : 'Frigo à relire'}
            {drafts.length > 1 ? ` · +${drafts.length - 1}` : ''}
          </Text>
          <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} numberOfLines={1}>
            Analysé {taskAge(latest.createdAt)}
          </Text>
        </YStack>
      </Pressable>
      <PillButton label="Relire" palette={palette} onPress={open} icon={(color) => <PencilIcon size={16} color={color} />} />
    </XStack>
  )
}
