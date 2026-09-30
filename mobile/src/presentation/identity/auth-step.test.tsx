import { useState } from 'react'
import { TextInput } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import { AuthStep } from './auth-step.js'

jest.mock('../shared/hover.js', () => ({ useReduceMotion: () => true }))

function Draft() {
  const [value, setValue] = useState('')
  return <TextInput testID="draft" value={value} onChangeText={setValue} />
}

test('preserves the draft when an animated step is hidden and restored', async () => {
  const view = await render(<AuthStep active><Draft /></AuthStep>)
  await fireEvent.changeText(view.getByTestId('draft'), 'Maison Bellevue')
  await view.rerender(<AuthStep active={false}><Draft /></AuthStep>)
  expect(view.queryByTestId('draft')).toBeNull()
  await view.rerender(<AuthStep active><Draft /></AuthStep>)
  expect(view.getByTestId('draft').props.value).toBe('Maison Bellevue')
})
