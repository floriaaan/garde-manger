import { test } from '@japa/runner'
import { __setReceiptExtractionOverrideForTests } from '#infrastructure/settings/ai-provider-registry'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'

const fakeDraft = {
  storeName: 'Carrefour',
  scannedAt: new Date('2026-08-26T18:00:00Z'),
  totalAmount: 4.8,
  items: [
    {
      name: 'Lait 1L',
      quantity: 2,
      unit: 'piece',
      category: 'Produits laitiers',
      price: 2.4,
      expiresInDays: 10,
    },
  ],
}

const fakeExtraction: ReceiptExtractionPort = {
  async extract() {
    return fakeDraft
  },
}

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer receipts' })
  return cookie
}

test.group('receipt: import, list, detail', (group) => {
  group.each.setup(() => {
    __setReceiptExtractionOverrideForTests(fakeExtraction)
    return () => __setReceiptExtractionOverrideForTests(null)
  })

  test('import creates the receipt and its products, list/detail reflect them', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'receipt-import@example.com')

    const importResponse = await client
      .post('/api/receipts/import')
      .headers({ cookie })
      .json({
        storeName: 'Carrefour',
        scannedAt: '2026-08-26T18:00:00Z',
        totalAmount: 4.8,
        items: [
          {
            name: 'Lait 1L',
            quantity: 2,
            unit: 'piece',
            category: 'Produits laitiers',
            price: 2.4,
            location: 'fridge',
          },
        ],
      })
    importResponse.assertStatus(201)
    assert.lengthOf(importResponse.body().products, 1)
    const receiptId = importResponse.body().receipt.id

    const list = await client.get('/api/receipts').headers({ cookie })
    assert.lengthOf(list.body().receipts, 1)

    const detail = await client.get(`/api/receipts/${receiptId}`).headers({ cookie })
    detail.assertBodyContains({ receipt: { storeName: 'Carrefour' } })
    assert.isNumber(detail.body().receipt.totalAmount)
    assert.lengthOf(detail.body().products, 1)
    assert.equal(detail.body().products[0].receiptId, receiptId)

    const productsList = await client.get('/api/products').headers({ cookie })
    assert.lengthOf(productsList.body().products, 1)
  })

  test('receipt image returns 404 when no imageKey was set on import', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'receipt-image@example.com')
    const importResponse = await client
      .post('/api/receipts/import')
      .headers({ cookie })
      .json({
        storeName: 'Carrefour',
        scannedAt: '2026-08-26T18:00:00Z',
        totalAmount: 1,
        items: [{ name: 'Item', quantity: 1, unit: 'piece', location: 'pantry' }],
      })
    const receiptId = importResponse.body().receipt.id

    const response = await client.get(`/api/receipts/${receiptId}/image`).headers({ cookie })
    response.assertStatus(404)
  })
})
