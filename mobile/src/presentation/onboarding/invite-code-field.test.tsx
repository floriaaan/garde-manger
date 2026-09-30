import { fireEvent, render, screen } from '@testing-library/react-native'
import { Keyboard } from 'react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { InviteCodeField } from './invite-code-field.js'

test('Done dismisses the invitation keyboard without clearing the code and still submits', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {})
  const onSubmit = jest.fn()
  try {
    await render(
      <ThemeProvider>
        <InviteCodeField value="AB12CD34" onChangeText={jest.fn()} onSubmit={onSubmit} />
      </ThemeProvider>,
    )
    const input = screen.getByTestId('invite-code-field')
    await fireEvent(input, 'focus')
    await fireEvent(input, 'submitEditing')
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('invite-code-field').props.value).toBe('AB12CD34')
    expect(input.props.submitBehavior).toBe('blurAndSubmit')
  } finally {
    dismiss.mockRestore()
  }
})
