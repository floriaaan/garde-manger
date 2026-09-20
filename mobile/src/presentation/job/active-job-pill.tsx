import { Platform, Pressable } from 'react-native'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import type { ReactNode } from 'react'
import { router, usePathname } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { ProgressBar } from '../shared/progress-bar.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette, type SoftPalette } from '../dashboard/soft-palette.js'
import { useJobsQuery } from '../../application/job/jobs.query.js'
import { isJobActive } from '../../domain/job/job.js'
import { JOB_TITLES, activeLabel, isBehindAnother } from './job-labels.js'

/** Clears the tab bar on phones; the pill is a shortcut to the task center, not part of the layout. */
const ABOVE_TAB_BAR = 96

/** iOS 26+ only: earlier iOS and Android keep the flat pastel card. */
const LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable()

// Same content either way; only the surface changes. The tint keeps the fresh-green
// identity and the text colour legible over whatever scrolls beneath.
function Card({ palette, children }: { palette: SoftPalette; children: ReactNode }) {
  return LIQUID_GLASS ? (
    <GlassView
      glassEffectStyle="regular"
      tintColor={palette.freshBg}
      style={{ borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}
    >
      {children}
    </GlassView>
  ) : (
    <YStack backgroundColor={palette.freshBg} borderRadius={18} paddingHorizontal="$3" paddingVertical="$2.5" gap="$1.5">
      {children}
    </YStack>
  )
}

/** Floating status of the oldest running job — "3 tasks" would hide what is actually happening. */
export function ActiveJobPill() {
  const palette = useSoftPalette()
  const pathname = usePathname()
  const jobs = useJobsQuery().data ?? []
  const active = jobs.filter(isJobActive)
  const job = active[active.length - 1]
  if (!job || pathname === '/tasks') return null

  const { done, total } = job.progress
  const determinate = job.kind === 'fridge_scan' && job.status === 'running' && total > 0
  const more = active.length > 1 ? ` · +${active.length - 1}` : ''

  return (
    <YStack position="absolute" left={16} right={16} bottom={ABOVE_TAB_BAR} alignItems="center" pointerEvents="box-none">
      <Pressable
        testID="active-job-pill"
        onPress={() => router.push('/tasks')}
        accessibilityRole="button"
        accessibilityLabel={`${JOB_TITLES[job.kind]} en cours. Ouvrir les tâches`}
        style={[pointerCursor, { width: '100%', maxWidth: 360 }]}
      >
        <Card palette={palette}>
          <XStack justifyContent="space-between" alignItems="center" gap="$2">
            <Text fontSize={13} fontWeight="800" color={palette.freshText} numberOfLines={1}>
              {JOB_TITLES[job.kind]}
              {more}
            </Text>
            <Text fontSize={12} fontWeight="600" color={palette.freshText}>
              {determinate ? `${done}/${total}` : activeLabel(job, isBehindAnother(job, jobs))}
            </Text>
          </XStack>
          <ProgressBar
            palette={palette}
            value={determinate ? done : undefined}
            total={determinate ? total : undefined}
            testID="active-job-pill-bar"
          />
        </Card>
      </Pressable>
    </YStack>
  )
}
