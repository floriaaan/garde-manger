import router from '@adonisjs/core/services/router'

const SubscriptionController = () => import('./subscription.controller.js')
const StripeWebhookController = () => import('./stripe-webhook.controller.js')

router.post('/api/settings/subscription/checkout', [SubscriptionController, 'checkout'])
router.post('/api/settings/subscription/portal', [SubscriptionController, 'portal'])

/**
 * Public: where Stripe's success/cancel/portal pages land. Stripe only takes web
 * URLs and the checkout runs in a system browser, so this hands the user back to
 * the app through its deep link — the browser sheet closes on it.
 */
router.get('/api/settings/subscription/return', ({ response }) =>
  response.redirect('gardemanger://subscription'),
)

/**
 * Public: Stripe has no session, it authenticates by signing the body with
 * `STRIPE_WEBHOOK_SECRET` (cf. the controller).
 */
router.post('/api/webhooks/stripe', [StripeWebhookController, 'handle'])
