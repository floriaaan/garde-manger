import { FakeFridgeConnector } from './fake-fridge-connector.js'
import { fakeProductOutcomes } from './fixtures/product-outcome.fixture.js'

test('getSession() starts null, sign-in populates it, sign-out clears it', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getSession()).toBeNull()

  const signIn = await connector.signInEmail('a@b.com', 'password')
  expect(signIn.ok).toBe(true)
  expect(await connector.getSession()).not.toBeNull()

  await connector.signOut()
  expect(await connector.getSession()).toBeNull()
})

test('signInEmail() rejects an empty password', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.signInEmail('a@b.com', '')
  expect(result.ok).toBe(false)
})

test('getAuthMethods() returns both methods enabled', async () => {
  const connector = new FakeFridgeConnector()
  const methods = await connector.getAuthMethods()
  expect(methods).toHaveLength(2)
  expect(methods.every((m) => m.enabled)).toBe(true)
})

test('getShoppingItems() returns the fixture list', async () => {
  const connector = new FakeFridgeConnector()
  const items = await connector.getShoppingItems()
  expect(items.length).toBeGreaterThan(0)
})

test('createShoppingItem() adds a new item to the list', async () => {
  const connector = new FakeFridgeConnector()
  const before = await connector.getShoppingItems()

  const result = await connector.createShoppingItem({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.value.name).toBe('Farine')
    expect(result.value.checked).toBe(false)
    expect(result.value.source).toBe('manual')
  }

  const after = await connector.getShoppingItems()
  expect(after.length).toBe(before.length + 1)
})

test('updateShoppingItem() patches an item and persists across calls', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getShoppingItems()
  expect(first.checked).toBe(false)

  const result = await connector.updateShoppingItem(first.id, { checked: true })
  expect(result.ok).toBe(true)

  const [updated] = await connector.getShoppingItems()
  expect(updated.checked).toBe(true)
})

test('updateShoppingItem() rejects an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.updateShoppingItem('does-not-exist', { checked: true })
  expect(result.ok).toBe(false)
})

test('deleteShoppingItem() removes the item from the list', async () => {
  const connector = new FakeFridgeConnector()
  const before = await connector.getShoppingItems()
  const [first] = before

  const result = await connector.deleteShoppingItem(first.id)
  expect(result.ok).toBe(true)

  const after = await connector.getShoppingItems()
  expect(after.length).toBe(before.length - 1)
  expect(after.find((i) => i.id === first.id)).toBeUndefined()
})

test('deleteShoppingItem() rejects an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.deleteShoppingItem('does-not-exist')
  expect(result.ok).toBe(false)
})

test('getRecipes() returns the fixture list', async () => {
  const connector = new FakeFridgeConnector()
  const recipes = await connector.getRecipes()
  expect(recipes.length).toBeGreaterThan(0)
})

test('getProducts() returns the fixture list', async () => {
  const connector = new FakeFridgeConnector()
  const products = await connector.getProducts()
  expect(products.length).toBeGreaterThan(0)
})

test('getProducts() filters by location', async () => {
  const connector = new FakeFridgeConnector()
  const products = await connector.getProducts({ location: 'freezer' })
  expect(products.every((p) => p.location === 'freezer')).toBe(true)
  expect(products.length).toBeGreaterThan(0)
})

test('createProduct() adds a product retrievable via getProduct()', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.createProduct({
    name: 'Yaourts nature',
    quantity: { amount: 8, unit: 'unités' },
    location: 'fridge',
    category: 'Produits laitiers',
  })
  expect(result.ok).toBe(true)
  if (!result.ok) return

  const fetched = await connector.getProduct(result.value.id)
  expect(fetched?.name).toBe('Yaourts nature')
})

test('updateProduct() patches an existing product', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getProducts()

  const result = await connector.updateProduct(first.id, { name: 'Lait entier' })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.name).toBe('Lait entier')
})

test('updateProduct() rejects an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.updateProduct('does-not-exist', { name: 'x' })
  expect(result.ok).toBe(false)
})

test('deleteProduct() removes the product', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getProducts()

  const result = await connector.deleteProduct(first.id)
  expect(result.ok).toBe(true)
  expect(await connector.getProduct(first.id)).toBeNull()
})

test('recordProductOutcome() of one unit decrements the product and logs the outcome', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.recordProductOutcome('fake-product-4', { kind: 'consumed', amount: 1 })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.product?.quantity.amount).toBe(3)
  expect((await connector.getProduct('fake-product-4'))?.quantity.amount).toBe(3)
  expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length + 1)
  expect(connector.outcomes.at(-1)).toMatchObject({ kind: 'consumed', quantity: { amount: 1 } })
})

test('recordProductOutcome() without an amount removes the product', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.recordProductOutcome('fake-product-6', {
    kind: 'discarded',
    discardReason: 'expired',
  })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.product).toBeNull()
  expect(await connector.getProduct('fake-product-6')).toBeNull()
  expect(connector.outcomes.at(-1)).toMatchObject({ discardReason: 'expired', quantity: { amount: 4 } })
})

test('recordProductOutcome() refuses an unknown product and more than the stock', async () => {
  const connector = new FakeFridgeConnector()
  expect((await connector.recordProductOutcome('nope', { kind: 'consumed' })).ok).toBe(false)
  expect((await connector.recordProductOutcome('fake-product-4', { kind: 'consumed', amount: 5 })).ok).toBe(false)
  expect(connector.outcomes).toHaveLength(fakeProductOutcomes.length)
})

test('lookupProductByBarcode() returns the fixture result for a known barcode', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.lookupProductByBarcode('3017620422003')
  expect(result?.name).toBe('Pâte à tartiner noisettes-cacao')
})

test('lookupProductByBarcode() returns null for an unknown barcode', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.lookupProductByBarcode('0000000000000')).toBeNull()
})

/** Polls the fake's job list until the job is terminal — the fake's worker is a detached promise. */
async function settled(connector: FakeFridgeConnector, jobId: string) {
  for (let i = 0; i < 200; i++) {
    const job = (await connector.getJobs()).find((j) => j.id === jobId)
    if (job && job.status !== 'queued' && job.status !== 'running') return job
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('job never settled')
}

test('enqueueReceiptScan() answers queued, then leaves a receipt draft once the job succeeds', async () => {
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  const enqueued = await connector.enqueueReceiptScan('file://anything.jpg')

  expect(enqueued.ok).toBe(true)
  if (!enqueued.ok) return
  expect(enqueued.value.status).toBe('queued')

  const job = await settled(connector, enqueued.value.id)
  expect(job.status).toBe('succeeded')
  const draft = await connector.getScanDraft(job.result?.draftId ?? '')
  expect(draft?.kind === 'receipt' && draft.draft.storeName).toBe('Carrefour')
})

test('importReceipt() creates a receipt and one product per item, linked by receiptId', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.importReceipt({
    storeName: 'Monoprix',
    scannedAt: '2026-08-29T09:00:00.000Z',
    totalAmount: 10,
    items: [{ name: 'Yaourts', quantity: 1, unit: 'pack', location: 'fridge' }],
  })

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.value.receipt.storeName).toBe('Monoprix')
  expect(result.value.products).toHaveLength(1)
  expect(result.value.products[0].receiptId).toBe(result.value.receipt.id)

  const receipts = await connector.getReceipts()
  expect(receipts.some((r) => r.id === result.value.receipt.id)).toBe(true)
})

test('getReceipt() returns the receipt and its imported products', async () => {
  const connector = new FakeFridgeConnector()
  const imported = await connector.importReceipt({
    storeName: 'Monoprix',
    scannedAt: '2026-08-29T09:00:00.000Z',
    totalAmount: 10,
    items: [{ name: 'Yaourts', quantity: 1, unit: 'pack', location: 'fridge' }],
  })
  if (!imported.ok) throw new Error('setup failed')

  const found = await connector.getReceipt(imported.value.receipt.id)

  expect(found?.receipt.id).toBe(imported.value.receipt.id)
  expect(found?.products).toHaveLength(1)
})

test('getReceipt() returns null for an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getReceipt('missing')).toBeNull()
})

test('getAiSettings() returns the fixture settings', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getAiSettings()).toEqual({
    activeProvider: 'gemini',
    source: 'environment',
    availableProviders: ['gemini', 'openai'],
    canChooseProvider: true,
    models: { vision: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
    access: { plan: 'free', used: 2, limit: 5, resetsAt: null, expiresAt: null },
  })
})

test('setActiveAiProvider() switches the active provider when it is available', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.setActiveAiProvider('openai')

  expect(result).toEqual({
    ok: true,
    value: {
      activeProvider: 'openai',
      source: 'environment',
      availableProviders: ['gemini', 'openai'],
      canChooseProvider: true,
      models: { vision: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
      access: { plan: 'free', used: 2, limit: 5, resetsAt: null, expiresAt: null },
    },
  })
})

test('setActiveAiProvider() rejects a provider that is not in availableProviders', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.setActiveAiProvider('ollama')

  expect(result.ok).toBe(false)
})

test('generating recipes is a job: queued at once, terminal only after the model latency', async () => {
  const connector = new FakeFridgeConnector({ aiLatencyMs: 50 })
  const enqueued = await connector.enqueueRecipeGeneration(undefined)

  expect(enqueued.ok && enqueued.value.status).toBe('queued')
  if (!enqueued.ok) return
  const job = await settled(connector, enqueued.value.id)

  expect(job.status).toBe('succeeded')
  expect(job.result?.recipeIds?.length).toBeGreaterThan(0)
})

test('the latency is a constructor knob, so a test that only wants the data pays nothing', async () => {
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  const enqueued = await connector.enqueueRecipeGeneration(undefined)
  if (!enqueued.ok) throw new Error('enqueue failed')

  const job = await settled(connector, enqueued.value.id)

  expect(job.status).toBe('succeeded')
})
