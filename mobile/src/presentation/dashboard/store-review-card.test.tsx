import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo, Linking, Platform } from 'react-native'
import * as StoreReview from 'expo-store-review'
import { ThemeProvider } from '../shared/theme-provider.js'
import { useSoftPalette } from './soft-palette.js'
import { StoreReviewCard } from './store-review-card.js'

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}))

const originalPlatform = Platform.OS
let openURL: jest.SpyInstance
let announce: jest.SpyInstance

function Card() {
  return <StoreReviewCard palette={useSoftPalette()} />
}

function renderCard() {
  render(<ThemeProvider><Card /></ThemeProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  Platform.OS = 'ios'
  jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(true)
  jest.mocked(StoreReview.requestReview).mockResolvedValue(undefined)
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
})

afterEach(() => {
  Platform.OS = originalPlatform
  openURL.mockRestore()
  announce.mockRestore()
})

test.each(['ios', 'android'] as const)('%s requests a native review only after a tap', async (platform) => {
  Platform.OS = platform
  renderCard()
  expect(StoreReview.isAvailableAsync).not.toHaveBeenCalled()
  expect(StoreReview.requestReview).not.toHaveBeenCalled()
  fireEvent.press(screen.getByTestId('dashboard-store-review'))
  await waitFor(() => expect(StoreReview.requestReview).toHaveBeenCalledTimes(1))
  expect(openURL).not.toHaveBeenCalled()
})

test('web has no review card and makes no store request', () => {
  Platform.OS = 'web'
  renderCard()
  expect(screen.queryByTestId('dashboard-store-review-card')).toBeNull()
  expect(StoreReview.isAvailableAsync).not.toHaveBeenCalled()
  expect(openURL).not.toHaveBeenCalled()
})

test.each([
  ['ios', 'https://apps.apple.com/app/id6816469647?action=write-review'],
  ['android', 'https://play.google.com/store/apps/details?id=com.floriaaan.gardemanger&showAllReviews=true'],
] as const)('%s opens the client listing when native reviews are unavailable', async (platform, url) => {
  Platform.OS = platform
  jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(false)
  renderCard()
  fireEvent.press(screen.getByTestId('dashboard-store-review'))
  await waitFor(() => expect(openURL).toHaveBeenCalledWith(url))
  expect(StoreReview.requestReview).not.toHaveBeenCalled()
})

test.each(['availability', 'request'] as const)('a failed native %s falls back to the store', async (step) => {
  const method = step === 'availability' ? StoreReview.isAvailableAsync : StoreReview.requestReview
  jest.mocked(method).mockRejectedValueOnce(new Error('Native review unavailable'))
  renderCard()
  fireEvent.press(screen.getByTestId('dashboard-store-review'))
  await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://apps.apple.com/app/id6816469647?action=write-review'))
})

test('store failures show a recoverable message and allow another tap', async () => {
  jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(false)
  openURL.mockRejectedValueOnce(new Error('No store available'))
  renderCard()
  fireEvent.press(screen.getByTestId('dashboard-store-review'))
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  fireEvent.press(screen.getByTestId('dashboard-store-review'))
  await waitFor(() => expect(openURL).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('alert')).toBeNull()
})

test('repeated taps cannot start concurrent requests', async () => {
  let finish!: (available: boolean) => void
  jest.mocked(StoreReview.isAvailableAsync).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  renderCard()
  const button = screen.getByTestId('dashboard-store-review')
  fireEvent.press(button)
  fireEvent.press(button)
  await waitFor(() => expect(StoreReview.isAvailableAsync).toHaveBeenCalledTimes(1))
  finish(true)
  await waitFor(() => expect(StoreReview.requestReview).toHaveBeenCalledTimes(1))
})

test.each(['ios', 'android'] as const)('%s exposes pending progress without launching a second request', async (platform) => {
  Platform.OS = platform
  let finish!: () => void
  jest.mocked(StoreReview.requestReview).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  renderCard()
  fireEvent.press(screen.getByTestId('dashboard-store-review'))
  await waitFor(() => expect(StoreReview.requestReview).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Ouverture des avis…', busy: true, disabled: true })).toBeTruthy()
  if (platform === 'ios') {
    expect(announce).toHaveBeenCalledWith('Ouverture des avis…')
  }
  finish()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ouvrir le store', busy: false, disabled: false })).toBeTruthy())
})

test.each([
  ['ios', 'https://apps.apple.com/app/id6816469647?action=write-review'],
  ['android', 'https://play.google.com/store/apps/details?id=com.floriaaan.gardemanger&showAllReviews=true'],
] as const)('%s offers a store alternative after the native attempt, only opening it on another tap', async (platform, url) => {
  Platform.OS = platform
  renderCard()
  expect(screen.queryByTestId('dashboard-store-review-help')).toBeNull()
  fireEvent.press(screen.getByTestId('dashboard-store-review'))
  await waitFor(() => expect(screen.getByTestId('dashboard-store-review-help')).toBeTruthy())
  expect(openURL).not.toHaveBeenCalled()
  fireEvent.press(screen.getByRole('button', { name: 'Ouvrir le store' }))
  await waitFor(() => expect(openURL).toHaveBeenCalledWith(url))
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1)
})

test('a failed explicit store alternative remains available for retry', async () => {
  openURL.mockRejectedValueOnce(new Error('Store unavailable'))
  renderCard()
  fireEvent.press(screen.getByTestId('dashboard-store-review'))
  await waitFor(() => expect(screen.getByTestId('dashboard-store-review-help')).toBeTruthy())
  fireEvent.press(screen.getByRole('button', { name: 'Ouvrir le store' }))
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  fireEvent.press(screen.getByRole('button', { name: 'Ouvrir le store' }))
  await waitFor(() => expect(openURL).toHaveBeenCalledTimes(2))
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1)
})
