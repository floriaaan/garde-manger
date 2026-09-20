import { useQueryClient } from '@tanstack/react-query'
import { defineQuery } from '../shared/define-query.js'
import { useDomainMutation } from '../shared/use-domain-mutation.js'
import { useDomainQuery } from '../shared/use-domain-query.js'
import type { ScanDraft } from '../../domain/job/job.js'

export const SCAN_DRAFTS_KEY = ['scan-drafts']

export const useScanDraftsQuery = defineQuery(SCAN_DRAFTS_KEY, (connector) => connector.getScanDrafts())

export function useScanDraftQuery(draftId: string | undefined) {
  return useDomainQuery<ScanDraft | null>(
    ['scan-drafts', draftId],
    (connector) => (draftId ? connector.getScanDraft(draftId) : Promise.resolve(null)),
    { enabled: Boolean(draftId) },
  )
}

export function useDiscardScanDraftMutation() {
  const queryClient = useQueryClient()
  return useDomainMutation((connector, draftId: string) => connector.discardScanDraft(draftId), {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCAN_DRAFTS_KEY }),
  })
}
