import { useLocalSearchParams } from 'expo-router'
import { ReceiptReviewScreen } from '../../presentation/receipt/receipt-review-screen.js'

export default function ReceiptReviewRoute() {
  const { imageUri, jobId, draftId } = useLocalSearchParams<{ imageUri?: string; jobId?: string; draftId?: string }>()
  return <ReceiptReviewScreen imageUri={imageUri} jobId={jobId} draftId={draftId} />
}
