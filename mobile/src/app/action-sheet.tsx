import { useEffect, useSyncExternalStore } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { nativeSheetStore } from '../presentation/shared/native-sheet-store.js'
import { useSoftPalette } from '../presentation/dashboard/soft-palette.js'

export default function NativeActionSheetScreen() {
  const { session = '' } = useLocalSearchParams<{ session: string }>()
  const sheet = useSyncExternalStore(nativeSheetStore.subscribe, nativeSheetStore.getSnapshot, nativeSheetStore.getSnapshot)
  const palette = useSoftPalette()
  const { height } = useWindowDimensions()
  useEffect(() => {
    // A direct link has no originating screen or callbacks.
    if (!nativeSheetStore.getSnapshot() && !nativeSheetStore.wasClosed(session)) {
      if (router.canGoBack()) router.back()
      else router.replace('/')
    }
    return () => nativeSheetStore.dismissed(session)
  }, [session])
  return <>
    <Stack.Screen options={{ contentStyle: { backgroundColor: palette.layoutSurface } }} />
    {/* fitToContents needs intrinsic height; flex: 1 would stretch the native sheet. */}
    <KeyboardAvoidingView style={{ flexShrink: 1, maxHeight: height * 0.9 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="automatic">
        <SafeAreaView edges={['bottom']} accessibilityViewIsModal onAccessibilityEscape={() => nativeSheetStore.close()}>
          {sheet?.session === session ? sheet.content : null}
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  </>
}
