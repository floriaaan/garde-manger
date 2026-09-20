import { useEffect } from 'react'
import { router } from 'expo-router'
import { useConnector } from '../../application/shared/connector-context.js'
import { listenToNotifications, syncPushToken } from '../../application/push/push-notifications.js'

/** Mounted once inside the signed-in area: keeps the device token fresh and routes notification taps. */
export function PushHost() {
  const connector = useConnector()

  useEffect(() => {
    void syncPushToken(connector)
  }, [connector])

  useEffect(() => {
    let stop = () => {}
    let cancelled = false
    void listenToNotifications((route) => router.push(route as never)).then((unsubscribe) => {
      if (cancelled) unsubscribe()
      else stop = unsubscribe
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  return null
}
