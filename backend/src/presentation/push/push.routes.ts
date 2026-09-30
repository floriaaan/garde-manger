import router from '@adonisjs/core/services/router'

const PushController = () => import('./push.controller.js')
const ReminderSettingsController = () => import('./reminder-settings.controller.js')

// Auth only: a device may register before the account has a household.
router
  .group(() => {
    router.post('/push-tokens', [PushController, 'register'])
    router.delete('/push-tokens', [PushController, 'unregister'])
    router.get('/web-push/config', [PushController, 'webConfig'])
    router.post('/web-push/subscriptions', [PushController, 'registerWeb'])
    router.delete('/web-push/subscriptions', [PushController, 'unregisterWeb'])
    router.get('/settings/expiry-reminders', [ReminderSettingsController, 'show'])
    router.patch('/settings/expiry-reminders', [ReminderSettingsController, 'update'])
  })
  .prefix('/api')
