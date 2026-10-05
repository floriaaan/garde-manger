import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Animated } from 'react-native'
import { showToast } from '../../application/shared/toast.js'
import { ThemeProvider } from './theme-provider.js'
import { ToastHost } from './toast.js'

test('the accessible retry action does not dismiss the replacement success toast', () => {
  jest.useFakeTimers()
  const finishes: Array<() => void> = []
  const timing = jest.spyOn(Animated, 'timing').mockImplementation((_value, config) => ({
    start: (callback) => {
      if (config.duration === 180 && callback) finishes.push(() => callback({ finished: true }))
    },
    stop: jest.fn(), reset: jest.fn(),
  }))
  const view = render(<ThemeProvider><ToastHost /></ThemeProvider>)
  try {
    act(() => {
      showToast('Impossible d’enregistrer.', 'error', {
        label: 'Réessayer', onPress: () => showToast('Réglages enregistrés.', 'success'),
      })
    })
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }))
    act(() => { finishes.forEach((finish) => finish()) })
    expect(screen.getByText('Réglages enregistrés.')).toBeTruthy()
    expect(screen.queryByText('Impossible d’enregistrer.')).toBeNull()
  } finally {
    view.unmount()
    timing.mockRestore()
    jest.useRealTimers()
  }
})

test('pending keeps its loader visible until settlement and updates without flashing its entrance', () => {
  jest.useFakeTimers()
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({
    start: jest.fn(), stop: jest.fn(), reset: jest.fn(),
  }))
  const view = render(<ThemeProvider><ToastHost /></ThemeProvider>)
  try {
    act(() => { showToast('Enregistrement…', 'loading') })
    const progress = timing.mock.calls[0][0] as Animated.Value
    const reset = jest.spyOn(progress, 'setValue')
    act(() => { jest.advanceTimersByTime(10000) })
    expect(screen.getByTestId('toast-loading')).toBeTruthy()
    expect(screen.getByText('Enregistrement…')).toBeTruthy()
    act(() => { showToast('Réglages enregistrés.', 'success') })
    expect(screen.queryByTestId('toast-loading')).toBeNull()
    expect(screen.getByText('Réglages enregistrés.')).toBeTruthy()
    expect(reset).not.toHaveBeenCalledWith(0)
    reset.mockRestore()
  } finally {
    view.unmount()
    timing.mockRestore()
    jest.useRealTimers()
  }
})
