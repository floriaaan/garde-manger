import type { ReactNode } from 'react'
import { Pressable } from 'react-native'
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { ProgressBar } from '../shared/progress-bar.js'
import { PillButton } from '../shared/pill-button.js'
import { goBack } from '../shared/navigation.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ArchiveIcon, ChefHatIcon, ClockIcon, PencilIcon, ReceiptIcon, RefreshIcon, ScanLineIcon, TrashIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { ConnectedPaywall } from '../settings/ai-access-cards.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { useScanDraftsQuery } from '../../application/job/scan-drafts.query.js'
import { useJobsQuery } from '../../application/job/jobs.query.js'
import { useDeleteJobMutation, useHideJobMutation, useRestoreJobMutation, useRetryJobMutation } from '../../application/job/job-mutations.js'
import { hasPartialFailure, isJobActive } from '../../domain/job/job.js'
import type { Job } from '../../domain/job/job.js'
import { JOB_TITLES, activeLabel, failureMessage, isBehindAnother, isRetryable, outcomeMessage, outcomeRoute, taskAge } from './job-labels.js'

const KIND_ICONS = { receipt_scan: ReceiptIcon, fridge_scan: ScanLineIcon, recipe_generation: ChefHatIcon } as const

/** Task center: what the AI is doing, and what it finished while the member was elsewhere. */
export function TasksScreen() {
  const palette = useSoftPalette()
  const jobsQuery = useJobsQuery()
  const draftsQuery = useScanDraftsQuery()
  const refresh = usePullToRefresh(jobsQuery.refetch, draftsQuery.refetch)
  const jobs = jobsQuery.data ?? []
  const { canSubscribe } = useAiSubscribe()
  const running = jobs.filter(isJobActive)
  const finished = jobs.filter((job) => !isJobActive(job) && !job.dismissedAt)
  const hidden = jobs.filter((job) => !isJobActive(job) && job.dismissedAt)

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      refresh={refresh}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ClockIcon size={19} color={color} />}
          title="Tâches"
          subtitle="Les analyses et recettes gardées 48 h"
          onBack={() => goBack('/(tabs)')}
        />
      }
    >
      <YStack gap="$5">
        <Section title="En cours" empty="Aucune analyse en cours." jobs={running} all={jobs} palette={palette} canSubscribe={canSubscribe} />
        <Section title="Terminées" empty="Rien de terminé pour le moment." jobs={finished} all={jobs} palette={palette} canSubscribe={canSubscribe} />
        <Section title="Masquées" empty="Aucune tâche masquée." jobs={hidden} all={jobs} palette={palette} canSubscribe={canSubscribe} />
      </YStack>
    </AppShell>
  )
}

function Section({
  title,
  empty,
  jobs,
  all,
  palette,
  canSubscribe,
}: {
  title: string
  empty: string
  jobs: Job[]
  all: Job[]
  palette: SoftPalette
  canSubscribe: boolean
}) {
  return (
    <YStack gap="$2.5">
      <Text fontSize={13} fontWeight="800" color={palette.inkSecondary}>
        {title}
      </Text>
      {jobs.length === 0 ? (
        <Text testID={`tasks-empty-${title}`} fontSize={13} fontWeight="500" color={palette.inkSecondary}>
          {empty}
        </Text>
      ) : null}
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} jobs={all} palette={palette} canSubscribe={canSubscribe} />
      ))}
    </YStack>
  )
}

function TextAction({ label, onPress, testID, color, icon }: { label: string; onPress: () => void; testID: string; color: string; icon: (color: string) => ReactNode }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[pointerCursor, { minHeight: 44, justifyContent: 'center' }]}>
      <XStack alignItems="center" gap="$1.5">
        {icon(color)}
        <Text fontSize={13} fontWeight="700" color={color}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  )
}

function JobCard({ job, jobs, palette, canSubscribe }: { job: Job; jobs: Job[]; palette: SoftPalette; canSubscribe: boolean }) {
  const retry = useRetryJobMutation()
  const hide = useHideJobMutation()
  const remove = useDeleteJobMutation()
  const restore = useRestoreJobMutation()
  const active = isJobActive(job)
  const failed = job.status === 'failed'
  const quota = failed && job.error?.type === 'ai_quota_exceeded'
  const partial = hasPartialFailure(job)
  const { done, total } = job.progress
  const determinate = job.kind === 'fridge_scan' && job.status === 'running' && total > 0
  const Icon = KIND_ICONS[job.kind]
  const tint = failed ? palette.expiredText : palette.freshText

  // One main action per state; the rest are quiet text actions.
  let action: { label: string; onPress: () => void; icon: (color: string) => ReactNode } | null = null
  if (job.status === 'succeeded') {
    action = {
      label: job.kind === 'recipe_generation' ? 'Voir les recettes' : 'Relire',
      icon: (color) => (job.kind === 'recipe_generation' ? <ChefHatIcon size={16} color={color} /> : <PencilIcon size={16} color={color} />),
      onPress: () => router.push(outcomeRoute(job) as Parameters<typeof router.push>[0]),
    }
  } else if (isRetryable(job)) {
    action = { label: 'Réessayer', icon: (color) => <RefreshIcon size={16} color={color} />, onPress: () => retry.mutate(job.id) }
  }

  // Without a second link the main action sits in the header row: one line less per card.
  const inlineAction = !partial
  const card = (
    <YStack
      testID={`task-${job.id}`}
      backgroundColor={palette.creamPill}
      borderRadius={22}
      padding="$3"
      gap="$2"
      style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2 }}
    >
      <XStack alignItems="center" gap="$3">
        <YStack width={36} height={36} borderRadius={12} backgroundColor={failed ? palette.expiredBg : palette.freshBg} alignItems="center" justifyContent="center">
          <Icon size={19} color={tint} />
        </YStack>
        <YStack flex={1}>
          <Text fontSize={15} fontWeight="800" color={palette.ink}>
            {JOB_TITLES[job.kind]}
          </Text>
          <Text fontSize={12} fontWeight="500" color={palette.inkSecondary}>
            {taskAge(job.finishedAt ?? job.createdAt)}
          </Text>
        </YStack>
        {inlineAction && action ? <PillButton testID={`task-${job.id}-action`} label={action.label} icon={action.icon} palette={palette} onPress={action.onPress} /> : null}
      </XStack>
      {active ? (
        <YStack gap="$2">
          <ProgressBar
            palette={palette}
            value={determinate ? done : undefined}
            total={determinate ? total : undefined}
            testID={`task-${job.id}-bar`}
          />
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
            {activeLabel(job, isBehindAnother(job, jobs))}
          </Text>
        </YStack>
      ) : (
        <Text fontSize={13} fontWeight="500" lineHeight={19} color={failed ? palette.expiredText : palette.inkSecondary}>
          {failed ? failureMessage(job) : outcomeMessage(job)}
          {partial ? ` — ${job.progress.failed.length} photo(s) manquante(s)` : ''}
        </Text>
      )}
      {quota && canSubscribe ? <ConnectedPaywall palette={palette} reason="Quota gratuit atteint" /> : null}
      {partial ? (
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <XStack alignItems="center" gap="$4">
            {partial ? (
              <TextAction testID={`task-${job.id}-retry-failed`} label="Photos manquantes" color={palette.ink} icon={(c) => <RefreshIcon size={15} color={c} />} onPress={() => retry.mutate(job.id)} />
            ) : null}
          </XStack>
          {action ? <PillButton testID={`task-${job.id}-action`} label={action.label} icon={action.icon} palette={palette} onPress={action.onPress} /> : null}
        </XStack>
      ) : null}
    </YStack>
  )

  // A running job cannot be hidden or deleted; the rest swipe: right reveals "Masquer"/"Démasquer" (left), left reveals "Supprimer" (right).
  if (active) return card
  return (
    <Swipeable
      overshootLeft={false}
      overshootRight={false}
      containerStyle={{ borderRadius: 22 }}
      renderLeftActions={(_progress, _translation, methods) =>
        job.dismissedAt ? (
          <SwipeAction
            side="left"
            testID={`task-${job.id}-restore`}
            label="Démasquer"
            background={palette.freshBg}
            color={palette.freshText}
            icon={<ArchiveIcon size={18} color={palette.freshText} />}
            onPress={() => {
              methods.close()
              restore.mutate(job.id)
            }}
          />
        ) : (
          <SwipeAction
            side="left"
            testID={`task-${job.id}-dismiss`}
            label="Masquer"
            background={palette.cream}
            color={palette.creamText}
            icon={<XIcon size={18} color={palette.creamText} />}
            onPress={() => {
              methods.close()
              hide.mutate(job.id)
            }}
          />
        )
      }
      renderRightActions={(_progress, _translation, methods) => (
        <SwipeAction
          side="right"
          testID={`task-${job.id}-delete`}
          label="Supprimer"
          background={palette.expiredBg}
          color={palette.expiredText}
          icon={<TrashIcon size={18} color={palette.expiredText} />}
          onPress={() => {
            methods.close()
            remove.mutate(job)
          }}
        />
      )}
    >
      {card}
    </Swipeable>
  )
}

function SwipeAction({ side, label, icon, background, color, onPress, testID }: { side: 'left' | 'right'; label: string; icon: ReactNode; background: string; color: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={pointerCursor}>
      <YStack width={92} height="100%" marginLeft={side === 'right' ? 10 : 0} marginRight={side === 'left' ? 10 : 0} borderRadius={22} backgroundColor={background} alignItems="center" justifyContent="center" gap="$1">
        {icon}
        <Text fontSize={12} fontWeight="700" color={color}>
          {label}
        </Text>
      </YStack>
    </Pressable>
  )
}

