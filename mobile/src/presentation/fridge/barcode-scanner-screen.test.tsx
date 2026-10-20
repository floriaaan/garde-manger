import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'
import { router } from 'expo-router'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
import { configureTelemetry } from '../../application/shared/telemetry.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { BarcodeScannerScreen } from './barcode-scanner-screen.js'

const mockRequestPermission = jest.fn(async () => ({}))
const mockGetPermission = jest.fn(async () => ({}))
let mockPermission = { granted: true, status: 'granted', canAskAgain: true }

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [mockPermission, mockRequestPermission, mockGetPermission],
}))

// `barcode-scanner-screen.tsx` reaches telemetry through `getTelemetry()`
// (the boundary lint forbids importing `infrastructure/telemetry` from
// presentation) — wiring the real singleton in here mirrors what
// `providers/wire-telemetry.ts` does for the app itself.
configureTelemetry(telemetry)

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), dismissTo: jest.fn() }, useFocusEffect: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  mockPermission = { granted: true, status: 'granted', canAskAgain: true }
})

test('scanning a barcode in create mode with no form open navigates to the new-product form with prefillBarcode', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="create" />
    </ThemeProvider>,
  )

  // NOTE: the brief's own test used `screen.UNSAFE_getByType('CameraView')`,
  // but this repo has @testing-library/react-native ^14 installed, which
  // removed the legacy UNSAFE_getByType/UNSAFE_getByProps queries entirely
  // (see its migration-v14 doc). testID + getByTestId is the v14-supported
  // equivalent for reaching into the mocked host element's props.
  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/fridge/new',
    params: { prefillBarcode: '3017620422003' },
  })
})

test("scanning a barcode in edit mode with no form open navigates to that product's edit form with prefillBarcode", async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="edit" productId="fake-product-1" />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/fridge/[id]/edit',
    params: { id: 'fake-product-1', prefillBarcode: '3017620422003' },
  })
})

test('scanning a barcode launched from an already-open form dismisses back onto it instead of opening a new one', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="create" fromForm />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/(tabs)/fridge/new', params: { prefillBarcode: '3017620422003' } })
  expect(router.replace).not.toHaveBeenCalled()
})

test('scanning a barcode launched from an already-open edit form also dismisses back onto it', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="edit" productId="fake-product-1" fromForm />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/(tabs)/fridge/[id]/edit', params: { id: 'fake-product-1', prefillBarcode: '3017620422003' } })
  expect(router.replace).not.toHaveBeenCalled()
})

test('multiple rapid onBarcodeScanned callbacks only navigate once', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="create" />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
    camera.props.onBarcodeScanned({ data: '3017620422003' })
    camera.props.onBarcodeScanned({ data: '0000000000000' })
  })

  expect(router.replace).toHaveBeenCalledTimes(1)
})

test('a router.replace failure in create mode records telemetry and falls back to the fridge tab', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  ;(router.replace as jest.Mock).mockImplementationOnce(() => {
    throw new Error('empty stack')
  })

  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="create" />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(spy).toHaveBeenCalledWith(
    'barcode scan navigation failed',
    expect.objectContaining({ attributes: { 'app.operation': 'fridge.barcode_scan_navigate' } }),
  )
  expect(router.replace).toHaveBeenLastCalledWith('/(tabs)/fridge')
  spy.mockRestore()
})

describe('iOS camera permission', () => {
  const originalOS = Platform.OS
  beforeEach(() => Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true }))
  afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }))

  test('first entry requests the system dialog directly without a custom pre-prompt', async () => {
    mockPermission = { granted: false, status: 'undetermined', canAskAgain: true }
    const ui = <ThemeProvider><BarcodeScannerScreen mode="create" /></ThemeProvider>
    const view = await render(ui)
    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('barcode-scanner-request-permission')).toBeNull()
    expect(screen.queryByTestId('fridge-barcode-camera')).toBeNull()
    await view.rerender(ui)
    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
  })

  test('granted permission opens the scanner without another request', async () => {
    await render(<ThemeProvider><BarcodeScannerScreen mode="create" /></ThemeProvider>)
    expect(screen.getByTestId('fridge-barcode-camera')).toBeTruthy()
    expect(mockRequestPermission).not.toHaveBeenCalled()
  })

  test.each([true, false])('denial offers Settings and manual entry without requesting again (canAskAgain=%s)', async (canAskAgain) => {
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
    mockPermission = { granted: false, status: 'denied', canAskAgain }
    await render(<ThemeProvider><BarcodeScannerScreen mode="create" /></ThemeProvider>)
    await fireEvent.press(screen.getByTestId('barcode-scanner-request-permission'))
    expect(settings).toHaveBeenCalledTimes(1)
    expect(mockRequestPermission).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('barcode-scanner-manual-entry'))
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/fridge/new')
    settings.mockRestore()
  })
})
