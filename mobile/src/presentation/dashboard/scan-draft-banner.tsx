import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useScanDraftsQuery } from '../../application/job/scan-drafts.query.js'
import type { SoftPalette } from './soft-palette.js'

/** An AI scan finished and nobody reviewed it yet — the case a toast cannot carry once it is gone. */
export function ScanDraftBanner({ palette }: { palette: SoftPalette }) {
  const drafts = useScanDraftsQuery().data ?? []
  const latest = drafts[0]
  if (!latest) return null

  const what = latest.kind === 'receipt' ? 'ticket' : 'frigo'
  const more = drafts.length > 1 ? ` (+${drafts.length - 1})` : ''
  const pathname = latest.kind === 'receipt' ? '/receipts/review' : '/fridge-scan/review'

  return (
    <Pressable
      testID="dashboard-scan-draft"
      onPress={() => router.push({ pathname, params: { draftId: latest.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Brouillon à relire : ${what}`}
      style={pointerCursor}
    >
      <XStack backgroundColor={palette.soonBg} borderRadius={16} paddingHorizontal="$3.5" paddingVertical="$3" justifyContent="space-between" alignItems="center">
        <Text fontSize={14} fontWeight="700" color={palette.soonText}>
          Brouillon à relire — {what}
          {more}
        </Text>
        <Text fontSize={13} fontWeight="800" color={palette.soonText}>
          Relire
        </Text>
      </XStack>
    </Pressable>
  )
}
