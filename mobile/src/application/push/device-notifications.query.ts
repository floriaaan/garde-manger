import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { isPushEnabled } from './push-notifications.js'

export const DEVICE_NOTIFICATIONS_KEY = ['device-notifications'] as const

export function useDeviceNotificationsQuery() {
  const status = useQuery({
    queryKey: DEVICE_NOTIFICATIONS_KEY,
    queryFn: isPushEnabled,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  })
  const { refetch } = status
  useFocusEffect(useCallback(() => { void refetch() }, [refetch]))
  return status
}
