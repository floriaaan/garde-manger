import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ProductController = () => import('./product.controller.js')

/**
 * `expiring-soon` and `lookup` are registered ahead of `:id` — same lesson
 * as Phase 1's `/api/auth/methods` vs `/api/auth/*` ordering fix: Adonis
 * matches routes in registration order, and `:id` would otherwise swallow
 * both literal paths.
 */
router
  .group(() => {
    router.get('/products', [ProductController, 'index'])
    router.post('/products', [ProductController, 'store'])
    router.post('/products/import', [ProductController, 'importProducts'])
    router.get('/products/expiring-soon', [ProductController, 'expiringSoon'])
    router.get('/products/lookup', [ProductController, 'lookup'])
    router.get('/products/outcomes/stats', [ProductController, 'outcomeStats'])
    router.get('/products/:id', [ProductController, 'show'])
    router.patch('/products/:id', [ProductController, 'update'])
    router.delete('/products/:id', [ProductController, 'destroy'])
    router.post('/products/:id/outcomes', [ProductController, 'recordOutcome'])
    router.get('/products/:id/image', [ProductController, 'image'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
