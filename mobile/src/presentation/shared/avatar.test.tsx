import { fireEvent, render, screen } from '@testing-library/react-native'
import { Avatar } from './avatar.js'
import { lightPaletteForTests as palette } from '../dashboard/soft-palette.js'

const svg = 'https://api.dicebear.com/10.x/initial-face/svg?seed=Thomas%20C.&animationVariant=medium'

test('uses initials when no image is available, including blank names', async () => {
  const view = await render(<Avatar name=" Thomas C. " palette={palette} />)
  expect(screen.getByText('TC')).toBeTruthy()
  await view.rerender(<Avatar name="   " palette={palette} />)
  expect(screen.getByText('?')).toBeTruthy()
})

test('loads DiceBear SVGs and falls back to initials on failure', async () => {
  await render(<Avatar name="Thomas C." image={svg} size={26} palette={palette} />)
  expect(screen.getByTestId('avatar-image').props.uri).toBe(svg)
  await fireEvent(screen.getByTestId('avatar-image'), 'error', new Error('Unavailable'))
  expect(screen.getByText('TC')).toBeTruthy()
})

test('loads photos, falls back on failure, and retries when the image changes', async () => {
  const view = await render(<Avatar name="Thomas C." image="https://example.com/avatar.jpg" palette={palette} />)
  expect(screen.getByTestId('avatar-image').props.source).toEqual({ uri: 'https://example.com/avatar.jpg' })
  await fireEvent(screen.getByTestId('avatar-image'), 'error', { nativeEvent: { error: 'Unavailable' } })
  expect(screen.getByText('TC')).toBeTruthy()
  await view.rerender(<Avatar name="Thomas C." image={svg} palette={palette} />)
  expect(screen.getByTestId('avatar-image').props.uri).toBe(svg)
})
