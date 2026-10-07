import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'
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
})

afterEach(() => {
  Platform.OS = originalPlatform
  openURL.mockRestore()
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
