import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptItemRow, type EditableReceiptItem } from './receipt-item-row.js'

const baseItem: EditableReceiptItem = {
  name: 'Lait',
  quantity: '2',
  unit: 'L',
  category: 'Produits laitiers',
  price: '2.4',
  location: 'fridge',
  expiresAt: '',
  expiresAtEstimated: false,
}

const noop = () => {}

function renderRow(props: Partial<React.ComponentProps<typeof ReceiptItemRow>> = {}) {
  return render(
    <ThemeProvider>
      <ReceiptItemRow
        index={0}
        item={baseItem}
        expanded
        onToggle={noop}
        onChange={noop}
        onRemove={noop}
        {...props}
      />
    </ThemeProvider>,
  )
}

// @testing-library/react-native v14: render() AND fireEvent (press/changeText/
// scroll) are async by default, both return a Promise — every call below must
// be awaited (cf. login-form.test.tsx's comment; this bit the mobile test
// harness once already).
test('editing the name calls onChange with the updated item', async () => {
  const onChange = jest.fn()
  await renderRow({ onChange })

  await fireEvent.changeText(screen.getByTestId('receipt-item-0-name'), 'Lait entier')

  expect(onChange).toHaveBeenCalledWith({ ...baseItem, name: 'Lait entier' })
})

test('selecting a location pill calls onChange with the new location', async () => {
  const onChange = jest.fn()
  await renderRow({ onChange })

  await fireEvent.press(screen.getByTestId('receipt-item-0-location-freezer'))

  expect(onChange).toHaveBeenCalledWith({ ...baseItem, location: 'freezer' })
})

test('a collapsed row shows a summary and no fields', async () => {
  await renderRow({ expanded: false })

  expect(screen.getByText('Lait')).toBeTruthy()
  expect(screen.getByText('2 L · Frigo · 2.4 €')).toBeTruthy()
  expect(screen.queryByTestId('receipt-item-0-name')).toBeNull()
})

test('the row can be removed from the receipt', async () => {
  const onRemove = jest.fn()
  await renderRow({ expanded: false, onRemove })

  await fireEvent.press(screen.getByTestId('receipt-item-0-remove'))

  expect(onRemove).toHaveBeenCalled()
})

test('a field error is shown on the field it belongs to', async () => {
  await renderRow({ errors: { quantity: 'Quantité invalide.' } })

  expect(screen.getByTestId('receipt-item-0-quantity-error')).toBeTruthy()
})

test('a filled-in date shows in the collapsed summary, same wording as the fridge list', async () => {
  const inFiveDays = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
  await renderRow({ item: { ...baseItem, expiresAt: inFiveDays }, expanded: false })

  expect(screen.getByText(/À consommer sous \d+ j/)).toBeTruthy()
})

test('an estimated date is flagged for review, and editing it by hand clears the flag', async () => {
  const onChange = jest.fn()
  await renderRow({ item: { ...baseItem, expiresAt: '2026-09-20', expiresAtEstimated: true }, onChange })

  expect(screen.getByText('Estimée par l’IA à partir du produit — vérifie si besoin.')).toBeTruthy()

  await fireEvent.changeText(screen.getByTestId('receipt-item-0-expires-at'), '2026-10-01')

  expect(onChange).toHaveBeenCalledWith({
    ...baseItem,
    expiresAt: '2026-10-01',
    expiresAtEstimated: false,
  })
})
