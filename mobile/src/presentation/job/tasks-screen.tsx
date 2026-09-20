import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { ProgressBar } from '../shared/progress-bar.js'
import { AuthButton } from '../identity/auth-button.js'
import { goBack } from '../shared/navigation.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ClockIcon } from '../dashboard/dashboard-icons.js'
import { ConnectedPaywall } from '../settings/ai-access-cards.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'
import { useJobsQuery } from '../../application/job/jobs.query.js'
import { useDismissJobMutation, useRetryJobMutation } from '../../application/job/job-mutations.js'
import { hasPartialFailure, isJobActive } from '../../domain/job/job.js'
import type { Job } from '../../domain/job/job.js'
import { JOB_TITLES, activeLabel, outcomeMessage, outcomeRoute } from './job-labels.js'

/** Task center: what the AI is doing, and what it finished while the member was elsewhere. */
export function TasksScreen() {
  const palette = useSoftPalette()
  const jobs = useJobsQuery().data ?? []
  const { canSubscribe } = useAiSubscribe()

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ClockIcon size={19} color={color} />}
          title="Tâches"
          subtitle="Analyses et recettes en cours ou récentes"
          onBack={() => goBack('/(tabs)')}
        />
      }
    >
      {jobs.length === 0 ? (
        <Text testID="tasks-empty" fontSize={14} fontWeight="500" color={palette.inkSecondary} textAlign="center" marginTop="$8">
          Rien en cours. Les analyses lancées apparaissent ici.
        </Text>
      ) : (
        <YStack gap="$3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} palette={palette} canSubscribe={canSubscribe} />
          ))}
        </YStack>
      )}
    </AppShell>
  )
}

function JobCard({ job, palette, canSubscribe }: { job: Job; palette: SoftPalette; canSubscribe: boolean }) {
  const retry = useRetryJobMutation()
  const dismiss = useDismissJobMutation()
  const active = isJobActive(job)
  const quota = job.status === 'failed' && job.error?.type === 'ai_quota_exceeded'
  const { done, total } = job.progress
  const determinate = job.kind === 'fridge_scan' && job.status === 'running' && total > 0

  // One main action per state.
  let action: { label: string; onPress: () => void } | null = null
  if (job.status === 'succeeded' && !hasPartialFailure(job)) {
    action = {
      label: job.kind === 'recipe_generation' ? 'Voir les recettes' : 'Relire',
      onPress: () => router.push(outcomeRoute(job) as Parameters<typeof router.push>[0]),
    }
  } else if (job.status === 'succeeded') {
    action = { label: 'Relire', onPress: () => router.push(outcomeRoute(job) as Parameters<typeof router.push>[0]) }
  } else if (job.status === 'failed' && !quota && job.error?.type !== 'provider_not_configured') {
    action = { label: 'Réessayer', onPress: () => retry.mutate(job.id) }
  }

  return (
    <YStack testID={`task-${job.id}`} backgroundColor={palette.cream} borderRadius={18} padding="$3.5" gap="$2.5">
      <Text fontSize={15} fontWeight="800" color={palette.ink}>
        {JOB_TITLES[job.kind]}
      </Text>
      {active ? (
        <>
          <ProgressBar
            palette={palette}
            value={determinate ? done : undefined}
            total={determinate ? total : undefined}
            testID={`task-${job.id}-bar`}
          />
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
            {activeLabel(job)}
          </Text>
        </>
      ) : (
        <Text fontSize={13} fontWeight="500" color={job.status === 'failed' ? palette.expiredText : palette.inkSecondary}>
          {job.status === 'failed' ? (job.error?.message ?? outcomeMessage(job)) : outcomeMessage(job)}
          {hasPartialFailure(job) ? ` — ${job.progress.failed.length} photo(s) manquante(s)` : ''}
        </Text>
      )}
      {quota && canSubscribe ? <ConnectedPaywall palette={palette} reason="Quota gratuit atteint" /> : null}
      {hasPartialFailure(job) ? (
        <AuthButton testID={`task-${job.id}-retry-failed`} label="Réessayer les photos manquantes" variant="secondary" onPress={() => retry.mutate(job.id)} />
      ) : null}
      <XStack gap="$2">
        {action ? (
          <YStack flex={1}>
            <AuthButton testID={`task-${job.id}-action`} label={action.label} onPress={action.onPress} />
          </YStack>
        ) : null}
        {!active ? (
          <YStack flex={action ? undefined : 1}>
            <AuthButton testID={`task-${job.id}-dismiss`} label="Masquer" variant="secondary" onPress={() => dismiss.mutate(job.id)} />
          </YStack>
        ) : null}
      </XStack>
    </YStack>
  )
}
