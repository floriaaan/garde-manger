import { useMemo } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { FridgeScanReviewScreen } from '../../presentation/fridge/fridge-scan-review-screen.js'

export default function FridgeScanReviewRoute() {
  const { imageUris, jobId, draftId } = useLocalSearchParams<{ imageUris?: string; jobId?: string; draftId?: string }>()
  const uris = useMemo(() => (imageUris ? (JSON.parse(imageUris) as string[]) : undefined), [imageUris])
  return <FridgeScanReviewScreen imageUris={uris} jobId={jobId} draftId={draftId} />
}
