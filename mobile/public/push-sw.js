self.addEventListener('push', (event) => {
  if (!event.data) return
  const { title, body } = event.data.json()
  event.waitUntil(self.registration.showNotification(title, {
    body,
    data: { route: '/fridge' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const route = '/fridge'
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) {
      await existing.focus()
      existing.navigate(route)
    } else {
      await self.clients.openWindow(route)
    }
  })())
})
