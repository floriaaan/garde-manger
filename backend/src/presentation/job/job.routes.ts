import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const JobController = () => import('./job.controller.js')

router
  .group(() => {
    router.post('/jobs/receipt-scan', [JobController, 'enqueueReceiptScan'])
    router.post('/jobs/fridge-scan', [JobController, 'enqueueFridgeScan'])
    router.post('/jobs/recipe-generation', [JobController, 'enqueueRecipeGeneration'])
    router.get('/jobs', [JobController, 'index'])
    router.get('/jobs/:id', [JobController, 'show'])
    router.post('/jobs/:id/retry', [JobController, 'retry'])
    router.delete('/jobs/:id', [JobController, 'dismiss'])
    router.get('/scan-drafts', [JobController, 'listDrafts'])
    router.get('/scan-drafts/:id', [JobController, 'showDraft'])
    router.delete('/scan-drafts/:id', [JobController, 'discardDraft'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
