// Service Worker for Push Notifications
// IUT Cafeteria - DevSprint 2026

const CACHE_NAME = 'iut-cafeteria-v1'

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated')
  event.waitUntil(self.clients.claim())
})

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event)
  
  let data = {
    title: 'IUT Cafeteria',
    body: 'You have a new notification',
    icon: '/iut-logo.png',
    badge: '/badge.png',
    data: {}
  }
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch (e) {
      data.body = event.data.text()
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/iut-logo.png',
    badge: data.badge || '/badge.png',
    vibrate: [100, 50, 100],
    data: data.data,
    actions: [
      { action: 'view', title: 'View Order' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: 'order-notification',
    renotify: true
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action)
  event.notification.close()
  
  if (event.action === 'dismiss') {
    return
  }
  
  // Default action or 'view' action - open the order tracker
  const urlToOpen = event.notification.data?.url || '/order-tracker'
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.navigate(urlToOpen)
            return client.focus()
          }
        }
        // Open a new window if none exists
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen)
        }
      })
  )
})

// Background sync for offline orders (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('[SW] Syncing offline orders...')
    // Handle offline order sync
  }
})
