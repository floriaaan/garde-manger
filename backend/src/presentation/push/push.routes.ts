import router from '@adonisjs/core/services/router'

const PushController = () => import('./push.controller.js')

// Auth only: a device may register before the account has a household.
router
  .group(() => {
    router.post('/push-tokens', [PushController, 'register'])
    router.delete('/push-tokens', [PushController, 'unregister'])
  })
  .prefix('/api')
