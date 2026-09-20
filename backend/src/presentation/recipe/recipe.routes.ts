import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const RecipeController = () => import('./recipe.controller.js')

/**
 * `suggestions` registered ahead of `:id` — same route-ordering
 * lesson as `product.routes.ts` (expiring-soon/lookup vs :id).
 */
router
  .group(() => {
    router.get('/recipes', [RecipeController, 'index'])
    router.post('/recipes', [RecipeController, 'store'])
    router.get('/recipes/suggestions', [RecipeController, 'suggestions'])
    router.get('/recipes/:id', [RecipeController, 'show'])
    router.post('/recipes/:id/cooked', [RecipeController, 'cooked'])
    router.delete('/recipes/:id', [RecipeController, 'destroy'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
