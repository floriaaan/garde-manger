import { Animated } from 'react-native'
import { render } from '@testing-library/react-native'
import { lightPaletteForTests } from '../dashboard/soft-palette.js'
import { PantryLoader } from './pantry-loader.js'

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }))
jest.mock('./hover.js', () => ({ useReduceMotion: () => true }))

test('announces one indeterminate loader and remains still under Reduce Motion', async () => {
  const loop = jest.spyOn(Animated, 'loop')
  try {
    const view = await render(<PantryLoader palette={lightPaletteForTests} label="Ouverture du garde-manger" />)
    const loader = view.getByRole('progressbar', { name: 'Ouverture du garde-manger' })
    expect(loader.props.accessibilityValue).toBeUndefined()
    expect(view.getAllByRole('progressbar')).toHaveLength(1)
    expect(loop).not.toHaveBeenCalled()
  } finally {
    loop.mockRestore()
  }
})
