import type { Session } from '../../../domain/identity/session.js'

export const fakeSession: Session = {
  user: { id: 'fake-user-1', email: 'demo@example.com', name: 'Thomas', image: `https://api.dicebear.com/10.x/initial-face/svg?seed=${encodeURIComponent('Thomas')}&animationVariant=medium` },
}
