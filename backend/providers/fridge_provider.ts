import type { ListProducts } from '#application/fridge/list-products.use-case'
import type { CreateProduct } from '#application/fridge/create-product.use-case'
import type { GetProduct } from '#application/fridge/get-product.use-case'
import type { UpdateProduct } from '#application/fridge/update-product.use-case'
import type { DeleteProduct } from '#application/fridge/delete-product.use-case'
import type { RecordProductOutcome } from '#application/fridge/record-product-outcome.use-case'
import type { GetProductOutcomeStats } from '#application/fridge/get-product-outcome-stats.use-case'
import type { GetExpiringSoonProducts } from '#application/fridge/get-expiring-soon-products.use-case'
import type { ImportProducts } from '#application/fridge/import-products.use-case'
import type { LookupProduct } from '#application/fridge/lookup-product.use-case'
import type { ApplicationService } from '@adonisjs/core/types'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { ProductLookupPort } from '#domain/fridge/interfaces/product-lookup-port.interface'
import type { ProductOutcomeStatsPort } from '#domain/fridge/interfaces/product-outcome-stats.interface'

export default class FridgeProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind('fridge.listProducts', async (resolver) => {
      const { ListProducts } = await import('#application/fridge/list-products.use-case')
      return new ListProducts(await resolver.make('fridge.products'))
    })

    this.app.container.bind('fridge.createProduct', async (resolver) => {
      const { CreateProduct } = await import('#application/fridge/create-product.use-case')
      return new CreateProduct(
        await resolver.make('fridge.products'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('fridge.getProduct', async (resolver) => {
      const { GetProduct } = await import('#application/fridge/get-product.use-case')
      return new GetProduct(await resolver.make('fridge.products'))
    })

    this.app.container.bind('fridge.updateProduct', async (resolver) => {
      const { UpdateProduct } = await import('#application/fridge/update-product.use-case')
      return new UpdateProduct(
        await resolver.make('fridge.products'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('fridge.deleteProduct', async (resolver) => {
      const { DeleteProduct } = await import('#application/fridge/delete-product.use-case')
      return new DeleteProduct(await resolver.make('fridge.products'))
    })

    this.app.container.bind('fridge.recordProductOutcome', async (resolver) => {
      const { RecordProductOutcome } =
        await import('#application/fridge/record-product-outcome.use-case')
      return new RecordProductOutcome(
        await resolver.make('fridge.products'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('fridge.getProductOutcomeStats', async (resolver) => {
      const { GetProductOutcomeStats } =
        await import('#application/fridge/get-product-outcome-stats.use-case')
      return new GetProductOutcomeStats(
        await resolver.make('fridge.outcomeStats'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('fridge.getExpiringSoonProducts', async (resolver) => {
      const { GetExpiringSoonProducts } =
        await import('#application/fridge/get-expiring-soon-products.use-case')
      return new GetExpiringSoonProducts(await resolver.make('fridge.products'))
    })

    this.app.container.bind('fridge.importProducts', async (resolver) => {
      const { ImportProducts } = await import('#application/fridge/import-products.use-case')
      return new ImportProducts(
        await resolver.make('fridge.products'),
        await resolver.make('shared.idGenerator'),
        await resolver.make('shared.clock'),
      )
    })

    this.app.container.bind('fridge.lookupProduct', async (resolver) => {
      const { LookupProduct } = await import('#application/fridge/lookup-product.use-case')
      return new LookupProduct(await resolver.make('fridge.productLookup'))
    })

    this.app.container.singleton('fridge.products', async () => {
      const { LucidProductRepository } =
        await import('#infrastructure/database/fridge/product.repository')
      return new LucidProductRepository()
    })

    this.app.container.singleton('fridge.productLookup', async () => {
      const { OpenFoodFactsAdapter } = await import('#infrastructure/fridge/openfoodfacts-adapter')
      return new OpenFoodFactsAdapter()
    })

    this.app.container.singleton('fridge.outcomeStats', async () => {
      const { LucidProductOutcomeStatsAdapter } =
        await import('#infrastructure/database/fridge/product-outcome-stats.adapter')
      return new LucidProductOutcomeStatsAdapter()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'fridge.listProducts': ListProducts
    'fridge.createProduct': CreateProduct
    'fridge.getProduct': GetProduct
    'fridge.updateProduct': UpdateProduct
    'fridge.deleteProduct': DeleteProduct
    'fridge.recordProductOutcome': RecordProductOutcome
    'fridge.getProductOutcomeStats': GetProductOutcomeStats
    'fridge.getExpiringSoonProducts': GetExpiringSoonProducts
    'fridge.importProducts': ImportProducts
    'fridge.lookupProduct': LookupProduct
    'fridge.products': ProductRepository
    'fridge.productLookup': ProductLookupPort
    'fridge.outcomeStats': ProductOutcomeStatsPort
  }
}
