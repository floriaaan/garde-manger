import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ReceiptController = () => import('./receipt.controller.js')

router
  .group(() => {
    router.post('/receipts/import', [ReceiptController, 'importReceipt'])
    router.get('/receipts', [ReceiptController, 'index'])
    router.get('/receipts/:id', [ReceiptController, 'show'])
    router.get('/receipts/:id/image', [ReceiptController, 'image'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
