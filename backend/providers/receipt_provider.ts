import type { ImportReceipt } from '#application/receipt/import-receipt.use-case'
import type { ListReceipts } from '#application/receipt/list-receipts.use-case'
import type { GetReceipt } from '#application/receipt/get-receipt.use-case'
import type { ApplicationService } from '@adonisjs/core/types'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'

export default class ReceiptProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind('receipt.importReceipt', async (resolver) => {
      const { ImportReceipt } = await import('#application/receipt/import-receipt.use-case')
      return new ImportReceipt(
        await resolver.make('receipt.receipts'),
        await resolver.make('fridge.products'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('receipt.listReceipts', async (resolver) => {
      const { ListReceipts } = await import('#application/receipt/list-receipts.use-case')
      return new ListReceipts(await resolver.make('receipt.receipts'))
    })

    this.app.container.bind('receipt.getReceipt', async (resolver) => {
      const { GetReceipt } = await import('#application/receipt/get-receipt.use-case')
      return new GetReceipt(
        await resolver.make('receipt.receipts'),
        await resolver.make('fridge.products'),
      )
    })

    this.app.container.singleton('receipt.receipts', async () => {
      const { LucidReceiptRepository } =
        await import('#infrastructure/database/receipt/receipt.repository')
      return new LucidReceiptRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'receipt.importReceipt': ImportReceipt
    'receipt.listReceipts': ListReceipts
    'receipt.getReceipt': GetReceipt
    'receipt.receipts': ReceiptRepository
  }
}
