import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

// Convert URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [registration, setRegistration] = useState(null)
  const [permission, setPermission] = useState('default')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if push is supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    setIsSupported(supported)
    
    if (supported) {
      setPermission(Notification.permission)
      registerServiceWorker()
    } else {
      setLoading(false)
    }
  }, [])

  // Register service worker
  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      console.log('Service Worker registered:', reg.scope)
      setRegistration(reg)
      
      // Check for existing subscription
      const existingSub = await reg.pushManager.getSubscription()
      if (existingSub) {
        setSubscription(existingSub)
        setIsSubscribed(true)
      }
      
      setLoading(false)
    } catch (err) {
      console.error('SW registration failed:', err)
      setError('Failed to register service worker')
      setLoading(false)
    }
  }

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!registration) {
      setError('Service worker not registered')
      return false
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Request notification permission
      const perm = await Notification.requestPermission()
      setPermission(perm)
      
      if (perm !== 'granted') {
        setError('Notification permission denied')
        setLoading(false)
        return false
      }
      
      // Get VAPID public key from server
      const { data: vapidData } = await axios.get('/api/auth/push/vapid-key')
      const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey)
      
      // Create push subscription
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      })
      
      // Send subscription to server
      const subJson = sub.toJSON()
      await axios.post('/api/auth/push/subscribe', {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      })
      
      setSubscription(sub)
      setIsSubscribed(true)
      setLoading(false)
      return true
    } catch (err) {
      console.error('Push subscription failed:', err)
      setError(err.response?.data?.message || 'Failed to subscribe')
      setLoading(false)
      return false
    }
  }, [registration])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) {
      return true
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Unsubscribe from push manager
      await subscription.unsubscribe()
      
      // Notify server
      await axios.delete('/api/auth/push/unsubscribe', {
        data: { endpoint: subscription.endpoint }
      })
      
      setSubscription(null)
      setIsSubscribed(false)
      setLoading(false)
      return true
    } catch (err) {
      console.error('Push unsubscribe failed:', err)
      setError(err.response?.data?.message || 'Failed to unsubscribe')
      setLoading(false)
      return false
    }
  }, [subscription])

  // Toggle subscription
  const toggle = useCallback(async () => {
    if (isSubscribed) {
      return await unsubscribe()
    } else {
      return await subscribe()
    }
  }, [isSubscribed, subscribe, unsubscribe])

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
    toggle
  }
}
