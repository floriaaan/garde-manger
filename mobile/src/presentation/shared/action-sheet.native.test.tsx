import { useState, useSyncExternalStore } from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from './theme-provider.js'
import { nativeSheetStore } from './native-sheet-store.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
// Bypass the inline web-content mock used by ordinary screen tests.
const { ActionSheet } = jest.requireActual('./action-sheet.native.js') as typeof import('./action-sheet.native.js')

function ContentHost() {
  const sheet = useSyncExternalStore(nativeSheetStore.subscribe, nativeSheetStore.getSnapshot)
  return <>{sheet?.content}</>
}

test('native sheet keeps a second step open and cancels through its owner', async () => {
  const onClose = jest.fn()
  function Harness() {
    const [visible, setVisible] = useState(true)
    const [secondStep, setSecondStep] = useState(false)
    return <ThemeProvider>
      <ActionSheet visible={visible} title={secondStep ? 'Confirmer' : 'Choisir'}
        onClose={() => { setVisible(false); onClose() }}
        options={[{ testID: 'next', label: 'Suite', icon: () => null, tint: '#000',
          keepOpen: true, onPress: () => setSecondStep(true) }]} />
      <ContentHost />
    </ThemeProvider>
  }
  await render(<Harness />)
  const session = nativeSheetStore.getSnapshot()?.session
  await fireEvent.press(screen.getByTestId('next'))
  expect(screen.getByText('Confirmer')).toBeTruthy()
  expect(nativeSheetStore.getSnapshot()?.session).toBe(session)
  expect(onClose).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('action-sheet-cancel'))
  expect(nativeSheetStore.getSnapshot()).toBeNull()
  expect(onClose).toHaveBeenCalledTimes(1)
})
