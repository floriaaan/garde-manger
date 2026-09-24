import { useMutation } from '@tanstack/react-query'
import { useConnector } from '../shared/connector-context.js'

export function useSubscribeToWaitlistMutation() {
  const connector = useConnector()
  return useMutation({
    mutationFn: (email: string) => connector.subscribeToWaitlist(email),
  })
}
