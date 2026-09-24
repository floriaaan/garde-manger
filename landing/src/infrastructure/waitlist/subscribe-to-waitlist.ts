import { createServerFn } from '@tanstack/react-start'
import { insertWaitlistEmail } from './waitlist-db.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const subscribeToWaitlistServerFn = createServerFn({ method: 'POST' })
  .validator((email: unknown) => {
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) throw new Error('Invalid email')
    return email
  })
  .handler(async ({ data: email }) => insertWaitlistEmail(email))
