import { useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { useCameraPermissions } from 'expo-camera'

/** Ask iOS directly once; a refusal is handled by the fallback, never a prompt loop. */
export function useScannerCameraPermissions() {
  const [permission, requestPermission, getPermission] = useCameraPermissions()
  const requested = useRef(false)
  const [requestFailed, setRequestFailed] = useState(false)
  const awaitingNativeRequest = Platform.OS === 'ios' && !requestFailed && (!permission || permission.status === 'undetermined')

  useEffect(() => {
    if (Platform.OS !== 'ios' || permission?.status !== 'undetermined' || requested.current) return
    requested.current = true
    void requestPermission().catch(() => setRequestFailed(true))
  }, [permission, requestPermission])

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission().catch(() => {})
    })
    return () => listener.remove()
  }, [getPermission])

  return { permission, requestPermission, awaitingNativeRequest }
}
